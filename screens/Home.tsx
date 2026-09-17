"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createRoom, joinRoom } from "@/lib/client/api";
import { useStore } from "@/lib/client/store";

export default function Home() {
  const session = useStore((s) => s.session);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(localStorage.getItem("uno.name") ?? "");
    setCode(new URLSearchParams(location.search).get("room")?.toUpperCase() ?? "");
  }, []);

  const disabled = busy || session !== null || name.trim().length === 0;

  const submit = async (e: FormEvent, fn: () => Promise<void>) => {
    e.preventDefault();
    localStorage.setItem("uno.name", name.trim());
    setBusy(true);
    await fn();
    setBusy(false);
  };

  return (
    <main className="home">
      <h1 className="logo">UNO</h1>
      <label>
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Nickname" autoFocus />
      </label>
      <form onSubmit={(e) => submit(e, () => createRoom(name.trim()))}>
        <button type="submit" className="primary" disabled={disabled}>Create room</button>
      </form>
      <div className="divider">or</div>
      <form onSubmit={(e) => submit(e, () => joinRoom(code.trim().toUpperCase(), name.trim()))} className="join">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={5}
          placeholder="ROOM CODE"
          className="code-input"
        />
        <button type="submit" disabled={disabled || code.trim().length !== 5}>Join</button>
      </form>
      {session && <p className="hint">Rejoining your room…</p>}
    </main>
  );
}
