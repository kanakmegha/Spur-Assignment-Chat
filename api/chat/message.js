import { supabase } from "../supabase";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).send("Method Not Allowed");

  const { message, sessionId } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message cannot be empty" });
  }

  let sid = sessionId;

  // Create new conversation if needed
  if (!sid) {
    const { data, error } = await supabase
      .from("conversations")
      .insert({})
      .select("id")
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed creating session" });
    }

    sid = data.id;
  }

  // Save user message
  await supabase.from("messages").insert({
    conversation_id: sid,
    sender: "user",
    text: message
  });

  // Fetch previous messages
  const { data: history } = await supabase
    .from("messages")
    .select("sender,text")
    .eq("conversation_id", sid)
    .order("id", { ascending: true })
    .limit(10);

  const SYSTEM = `
You are a helpful support agent for a fictional e-commerce store.

Store Knowledge:
- Shipping worldwide: 5–7 business days
- Returns: 30-day, no questions asked
- Support hours: 9am–6pm IST
`;

  const llmMessages = [
    { role: "system", content: SYSTEM },
    ...history.map((h) => ({
      role: h.sender === "user" ? "user" : "assistant",
      content: h.text
    })),
    { role: "user", content: message }
  ];

  let reply = "Sorry, I am having trouble responding.";

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: llmMessages,
      max_tokens: 150
    });

    reply = completion.choices[0].message.content;
  } catch (err) {
    console.error("LLM Error:", err);
  }

  // Save AI reply
  await supabase.from("messages").insert({
    conversation_id: sid,
    sender: "ai",
    text: reply
  });

  return res.status(200).json({ reply, sessionId: sid });
}
