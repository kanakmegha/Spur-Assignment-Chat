import { supabase } from "../supabase";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  // 1. Method check
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // 2. Global Try-Catch to prevent the "A server error..." plain text crash
  try {
    const { message, sessionId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message cannot be empty" });
    }

    // Check if API Key exists before calling OpenAI
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is missing in environment variables");
    }

    let sid = sessionId;

    // Create new conversation if needed
    if (!sid) {
      const { data, error: createError } = await supabase
        .from("conversations")
        .insert({})
        .select("id")
        .single();

      if (createError) {
        console.error("Supabase Session Error:", createError);
        return res.status(500).json({ error: "Failed creating session" });
      }
      sid = data.id;
    }

    // Save user message
    const { error: userMsgError } = await supabase.from("messages").insert({
      conversation_id: sid,
      sender: "user",
      text: message
    });
    
    if (userMsgError) throw new Error("Failed to save user message");

    // Fetch previous messages
    const { data: history, error: historyError } = await supabase
      .from("messages")
      .select("sender,text")
      .eq("conversation_id", sid)
      .order("created_at", { ascending: true }) // Using created_at is safer than id
      .limit(10);

    if (historyError) throw new Error("Failed to fetch history");

    const SYSTEM = `
You are a helpful support agent for a fictional e-commerce store.
Store Knowledge:
- Shipping worldwide: 5–7 business days
- Returns: 30-day, no questions asked
- Support hours: 9am–6pm IST
`;

    // Map history to OpenAI format
    const llmMessages = [
      { role: "system", content: SYSTEM },
      ...(history || []).map((h) => ({
        role: h.sender === "user" ? "user" : "assistant",
        content: h.text
      })),
      { role: "user", content: message }
    ];

    // Call OpenAI
    let reply;
    try {
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: llmMessages,
        max_tokens: 150
      });
      reply = completion.choices[0].message.content;
    } catch (llmErr) {
      console.error("OpenAI API Error:", llmErr);
      return res.status(502).json({ error: "AI service is temporarily unavailable" });
    }

    // Save AI reply
    const { error: aiMsgError } = await supabase.from("messages").insert({
      conversation_id: sid,
      sender: "assistant", // Changed from "ai" to match roles
      text: reply
    });

    if (aiMsgError) console.error("Error saving AI reply:", aiMsgError);

    // Final successful JSON response
    return res.status(200).json({ reply, sessionId: sid });

  } catch (globalError) {
    console.error("Critical Backend Error:", globalError.message);
    // This ensures we ALWAYS return JSON, even on a total crash
    return res.status(500).json({ 
      error: "Internal Server Error", 
      details: globalError.message 
    });
  }
}