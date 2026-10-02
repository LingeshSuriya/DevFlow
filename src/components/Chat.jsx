import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Hash } from "lucide-react";
import Header from "./Header";
import { api } from "../api";
import { socket } from "../socket";
import { useOrg } from "../context/OrgContext";
import { can } from "../data/permissions";

export default function Chat() {
  const { activeOrgId, activeOrg } = useOrg();
  const canSend = can(activeOrg?.role, "SEND_CHAT");
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!activeOrgId) return;
    setActiveChannel(null);
    setMessages([]);
    api
      .getChannels()
      .then((channelsRes) => {
        setChannels(channelsRes);
        const general = channelsRes.find((c) => c.name === "general") || channelsRes[0];
        setActiveChannel(general || null);
      })
      .catch((e) => setError(e.message));
  }, [activeOrgId]);

  useEffect(() => {
    if (!activeChannel) return;
    api.getMessages(activeChannel.id).then(setMessages).catch((e) => setError(e.message));

    const join = () => socket.emit("channel:join", activeChannel.id);
    join();
    const onNewMessage = (msg) => {
      if (msg.channelId === activeChannel.id) setMessages((prev) => [...prev, msg]);
    };
    socket.on("message:new", onNewMessage);
    socket.on("connect", join); // rooms are lost on reconnect

    return () => {
      socket.emit("channel:leave", activeChannel.id);
      socket.off("message:new", onNewMessage);
      socket.off("connect", join);
    };
  }, [activeChannel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || !activeChannel || !canSend) return;
    setDraft("");
    try {
      await api.sendMessage(activeChannel.id, { text });
    } catch (e) {
      setError(e.message);
    }
  }, [draft, activeChannel, canSend]);

  if (!activeChannel) return <div className="p-6 text-sm text-zinc-500">Loading chat...</div>;

  return (
    <div className="h-full flex flex-col">
      <Header title="Chat" subtitle={`#${activeChannel.name}`} />
      <div className="flex-1 flex min-h-0">
        <div className="w-44 border-r border-zinc-800 py-3 px-2 shrink-0">
          {channels.map((c) => (
            <button key={c.id} onClick={() => setActiveChannel(c)}
              className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm text-left ${c.id === activeChannel.id ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
              <Hash size={13} /> {c.name}
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {error && <div className="m-3 text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-3 py-2">{error}</div>}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m) => <MessageRow key={m.id} message={m} />)}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-zinc-800 flex items-center gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={canSend ? `Message #${activeChannel.name}` : "Viewer role — read only"}
              disabled={!canSend}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-60" />
            <button onClick={send} disabled={!canSend} className="h-9 w-9 flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 rounded-md text-zinc-950 transition-colors">
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageRow({ message }) {
  const initials = message.user?.initials || "?";
  const color = message.user?.color || "bg-zinc-600";
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="flex items-start gap-2.5">
      <div className={`h-7 w-7 rounded-full ${color} flex items-center justify-center text-[10px] font-mono text-zinc-950 shrink-0`}>{initials}</div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-zinc-200 font-medium">{message.user?.name}</span>
          <span className="text-[11px] text-zinc-600">{time}</span>
        </div>
        <div className="text-sm text-zinc-400">{message.text}</div>
      </div>
    </div>
  );
}
