// This works no matter how many folders deep you are
import { supabase } from "@/supabase"; // Adjust path based on your folder structure
import OpenAI from "openai";

// Initialize the Groq client using the OpenAI SDK
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { message, sessionId } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    let sid = sessionId;

    // 2. Database: Handle Session (Supabase)
    if (!sid) {
      const { data, error: sessionError } = await supabase
        .from("conversations")
        .insert({})
        .select("id")
        .single();
      
      if (sessionError) throw new Error("Supabase: Failed to create session");
      sid = data.id;
    }

    // 3. Database: Save User Message
    await supabase.from("messages").insert({
      conversation_id: sid,
      sender: "user",
      text: message
    });

    // 4. Database: Fetch Context (Last 6 messages)
    const { data: history } = await supabase
      .from("messages")
      .select("sender,text")
      .eq("conversation_id", sid)
      .order("id", { ascending: true })
      .limit(6);

    // 5. Format for Groq
    const messages = [
      { role: "system", content: "You are a helpful e-commerce support assistant." },
      ...(history || []).map((h) => ({
        role: h.sender === "user" ? "user" : "assistant",
        content: h.text
      })),
      { role: "user", content: message }
    ];

    // 6. Call Groq
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile", // This is the best free model on Groq right now
      messages: messages,
      max_tokens: 500,
      temperature: 0.7
    });

    const reply = completion.choices[0].message.content;

    // 7. Database: Save AI Reply
    await supabase.from("messages").insert({
      conversation_id: sid,
      sender: "assistant",
      text: reply
    });

    // 8. Return Success JSON
    return res.status(200).json({ reply, sessionId: sid });

  } catch (error) {
    console.error("Internal Error:", error.message);
    // This JSON response prevents the "Unexpected token A" error on frontend
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}