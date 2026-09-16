import { useState, type FormEvent } from "react";
import { send } from "../ws.js";
import { useStore } from "../store.js";

export default function Home() {
  const status = useStore((s) => s.status);
  const [name, setName] = useState(() => localStorage.getItem("uno.name") ?? "");
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get("room")?.toUpperCase() ?? "");
  const disabled = status !== "connected" || name.trim().length === 0;

  const remember = () => localStorage.setItem("uno.name", name.trim());

  const create = (e: FormEvent) => {
    e.preventDefault();
    remember();
    send({ type: "createRoom", name: name.trim() });
  };
  const join = (e: FormEvent) => {
    e.preventDefault();
    remember();
    send({ type: "joinRoom", name: name.trim(), code: code.trim().toUpperCase() });
  };

  return (
    <main className="home">
      <h1 className="logo">UNO</h1>
      <label>
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Nickname" autoFocus />
      </label>
      <form onSubmit={create}>
        <button type="submit" className="primary" disabled={disabled}>Create room</button>
      </form>
      <div className="divider">or</div>
      <form onSubmit={join} className="join">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={5}
          placeholder="ROOM CODE"
          className="code-input"
        />
        <button type="submit" disabled={disabled || code.trim().length !== 5}>Join</button>
      </form>
    </main>
  );
}
