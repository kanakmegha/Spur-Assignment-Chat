import { supabase } from "../supabase";

export default async function handler(req, res) {
  const { sessionId } = req.query;

  if (!sessionId) return res.json([]);

  const { data } = await supabase
    .from("messages")
    .select("sender,text")
    .eq("conversation_id", sessionId)
    .order("id", { ascending: true });

  return res.json(data || []);
}
