import { useEffect, useState, useRef } from "react";

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState(
    localStorage.getItem("sessionId")
  );
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef(null);

  useEffect(() => {
    if (sessionId) {
      fetch(`/api/chat/history?sessionId=${sessionId}`)
        .then((r) => r.json())
        .then((data) => setMessages(data));
    }
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const temp = [...messages, { sender: "user", text: input }];
    setMessages(temp);
    setLoading(true);

    const res = await fetch("/api/chat/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input, sessionId }),
    });

    const data = await res.json();

    setSessionId(data.sessionId);
    localStorage.setItem("sessionId", data.sessionId);

    setMessages([...temp, { sender: "ai", text: data.reply }]);
    setInput("");
    setLoading(false);
  };

  return (
    <div className="chat-box">
      <div className="messages">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`msg ${m.sender === "user" ? "user" : "ai"}`}
          >
            {m.text}
          </div>
        ))}
        {loading && <div className="msg ai">Agent is typing…</div>}
        <div ref={scrollRef}></div>
      </div>

      <div className="input-box">
        <input
          value={input}
          placeholder="Ask something…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button disabled={loading} onClick={sendMessage}>
          Send
        </button>
      </div>
    </div>
  );
}
