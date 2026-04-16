'use client';

import { useEffect, useRef, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Msg =
  | { role: 'agent'; text: string; decision?: string }
  | { role: 'caller'; text: string }
  | { role: 'system'; text: string };

export default function SimulatorPage() {
  const [phone, setPhone] = useState('+919999900001');
  const [name, setName] = useState('Dr. Sharma');
  const [profession, setProfession] = useState<'doctor' | 'other'>('doctor');
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [callerFrom, setCallerFrom] = useState('+91DEMO_CALLER');
  const wsRef = useRef<WebSocket | null>(null);

  async function bootstrap() {
    // 1. OTP request + verify (demo: code always 123456)
    await fetch(`${API_URL}/auth/request-otp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const res = await fetch(`${API_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone, code: '123456', name, profession }),
    });
    const data = await res.json();
    setUserId(data.user.id);
    setMessages([
      { role: 'system', text: `Signed in as ${data.user.name} (${data.user.profession})` },
    ]);
  }

  function placeCall() {
    if (!userId) return;
    const wsUrl = API_URL.replace(/^http/, 'ws') + '/demo/call';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true);
      setMessages((m) => [...m, { role: 'system', text: `📞 Unknown number ${callerFrom} calling…` }]);
      ws.send(JSON.stringify({ type: 'start', userId, fromNumber: callerFrom }));
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'agent_text') {
        setMessages((m) => [...m, { role: 'agent', text: msg.text, decision: msg.decision }]);
      } else if (msg.type === 'call_ended') {
        setMessages((m) => [
          ...m,
          {
            role: 'system',
            text: `Call ended — outcome: ${msg.outcome.toUpperCase()} — reason: ${msg.reason ?? '—'}`,
          },
        ]);
        setConnected(false);
      } else if (msg.type === 'error') {
        setMessages((m) => [...m, { role: 'system', text: `Error: ${msg.error}` }]);
      }
    };
    ws.onclose = () => setConnected(false);
  }

  function send() {
    if (!input.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'caller_text', text: input }));
    setMessages((m) => [...m, { role: 'caller', text: input }]);
    setInput('');
  }

  function hangup() {
    wsRef.current?.send(JSON.stringify({ type: 'end' }));
    wsRef.current?.close();
  }

  useEffect(() => () => wsRef.current?.close(), []);

  return (
    <div className="grid md:grid-cols-[320px_1fr] gap-6">
      <aside className="card space-y-4 h-fit">
        <div>
          <div className="label">Your phone (creates a demo user)</div>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <div className="label">Your name</div>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <div className="label">Profession</div>
          <select
            className="input"
            value={profession}
            onChange={(e) => setProfession(e.target.value as 'doctor' | 'other')}
          >
            <option value="doctor">Doctor (template)</option>
            <option value="other">Other (generic)</option>
          </select>
        </div>
        <button className="btn-primary w-full justify-center" onClick={bootstrap}>
          {userId ? '✓ Signed in (reset)' : '1. Sign in (demo)'}
        </button>
        <hr className="border-gatekeep-border" />
        <div>
          <div className="label">Unknown caller number</div>
          <input className="input" value={callerFrom} onChange={(e) => setCallerFrom(e.target.value)} />
        </div>
        <button
          className="btn-primary w-full justify-center disabled:opacity-50"
          disabled={!userId || connected}
          onClick={placeCall}
        >
          2. 📞 Place incoming call
        </button>
        {connected && (
          <button className="btn-ghost w-full justify-center" onClick={hangup}>
            Hang up
          </button>
        )}
      </aside>

      <section className="card flex flex-col h-[72vh]">
        <div className="text-lg font-semibold mb-3">
          Live conversation with Gatekeep
          {connected && <span className="pill bg-green-500/20 text-green-400 ml-2">LIVE</span>}
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {messages.length === 0 && (
            <div className="text-gatekeep-muted text-sm">
              Sign in on the left, then place an incoming call. You&apos;ll role-play the unknown caller.
            </div>
          )}
          {messages.map((m, i) => (
            <Bubble key={i} msg={m} />
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            className="input flex-1"
            placeholder={connected ? 'Type what the caller says…' : 'Place a call first'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            disabled={!connected}
          />
          <button className="btn-primary" onClick={send} disabled={!connected || !input.trim()}>
            Send
          </button>
        </div>
      </section>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  if (msg.role === 'system') {
    return <div className="text-xs text-gatekeep-muted italic">— {msg.text} —</div>;
  }
  const isAgent = msg.role === 'agent';
  return (
    <div className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
          isAgent
            ? 'bg-gatekeep-accentSoft text-white rounded-tl-sm'
            : 'bg-gatekeep-border text-white rounded-tr-sm'
        }`}
      >
        <div className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">
          {isAgent ? 'Gatekeep AI' : 'Caller (you)'}
          {msg.role === 'agent' && msg.decision && msg.decision !== 'CONTINUE' && (
            <span className="ml-2 pill bg-gatekeep-accent text-white">{msg.decision}</span>
          )}
        </div>
        {msg.text}
      </div>
    </div>
  );
}
