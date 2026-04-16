'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Call {
  id: string;
  from_number: string;
  started_at: string;
  ended_at: string | null;
  outcome: string;
  decision_reason: string | null;
  summary: string | null;
  turns: { speaker: 'agent' | 'caller'; text: string }[];
}

export default function CallsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [sel, setSel] = useState<Call | null>(null);

  async function signInDemo() {
    await fetch(`${API_URL}/auth/request-otp`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '+919999900001' }),
    });
    const r = await fetch(`${API_URL}/auth/verify-otp`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '+919999900001', code: '123456', name: 'Dr. Sharma', profession: 'doctor' }),
    });
    const d = await r.json();
    setToken(d.token);
  }

  useEffect(() => { if (!token) signInDemo(); }, [token]);
  useEffect(() => {
    if (!token) return;
    const load = () =>
      fetch(`${API_URL}/calls`, { headers: { authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setCalls(d.calls ?? []));
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [token]);

  return (
    <div className="grid md:grid-cols-[360px_1fr] gap-6">
      <aside className="card h-[75vh] overflow-y-auto">
        <div className="font-semibold mb-3">Call Log ({calls.length})</div>
        {calls.length === 0 && <div className="text-sm text-gatekeep-muted">No calls yet. Try the simulator!</div>}
        <ul className="space-y-1">
          {calls.map((c) => (
            <li
              key={c.id}
              onClick={() => setSel(c)}
              className={`cursor-pointer rounded-lg p-3 hover:bg-gatekeep-accentSoft ${sel?.id === c.id ? 'bg-gatekeep-accentSoft' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{c.from_number}</span>
                <Outcome outcome={c.outcome} />
              </div>
              <div className="text-xs text-gatekeep-muted mt-1">
                {new Date(c.started_at).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <section className="card h-[75vh] overflow-y-auto">
        {!sel ? (
          <div className="text-gatekeep-muted text-sm">Select a call to see the transcript.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono">{sel.from_number}</div>
                <div className="text-xs text-gatekeep-muted">
                  {new Date(sel.started_at).toLocaleString()} → {sel.ended_at ? new Date(sel.ended_at).toLocaleTimeString() : '—'}
                </div>
              </div>
              <Outcome outcome={sel.outcome} />
            </div>
            {sel.decision_reason && (
              <div className="text-sm">
                <span className="text-gatekeep-muted">Decision reason:</span> {sel.decision_reason}
              </div>
            )}
            {sel.summary && (
              <div className="text-sm">
                <span className="text-gatekeep-muted">Summary:</span> {sel.summary}
              </div>
            )}
            <div className="space-y-2">
              {sel.turns.map((t, i) => (
                <div key={i} className={`flex ${t.speaker === 'agent' ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                      t.speaker === 'agent' ? 'bg-gatekeep-accentSoft' : 'bg-gatekeep-border'
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">
                      {t.speaker === 'agent' ? 'Gatekeep AI' : 'Caller'}
                    </div>
                    {t.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Outcome({ outcome }: { outcome: string }) {
  const map: Record<string, string> = {
    forwarded: 'bg-green-500/20 text-green-400',
    rejected: 'bg-red-500/20 text-red-400',
    bridged_known: 'bg-blue-500/20 text-blue-400',
    hungup: 'bg-gray-500/20 text-gray-300',
    in_progress: 'bg-yellow-500/20 text-yellow-300',
    error: 'bg-red-500/20 text-red-400',
  };
  return <span className={`pill ${map[outcome] ?? 'bg-gatekeep-border'}`}>{outcome.replace('_', ' ')}</span>;
}
