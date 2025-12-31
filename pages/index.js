import { useState } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  const [chat, setChat] = useState([]);
  const [sid, setSid] = useState(null);

  const sendMessage = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, sessionId: sid }),
      });

      // SAFETY CHECK: If response is not OK, don't try to parse JSON yet
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Server crashed" }));
        throw new Error(errorData.error);
      }

      const data = await res.json();
      setChat([...chat, { role: "user", content: input }, { role: "assistant", content: data.reply }]);
      setSid(data.sessionId);
      setInput("");
    } catch (err) {
      alert("Chat Error: " + err.message);
    }
  };

  return (
    <div>
      {/* Your Chat UI mapping over 'chat' array */}
      <form onSubmit={sendMessage}>
        <input value={input} onChange={(e) => setInput(e.target.value)} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}