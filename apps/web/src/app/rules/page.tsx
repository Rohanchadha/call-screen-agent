'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Profile {
  id: string;
  name: string;
  is_active: boolean;
  language: string;
  greeting_text: string;
  policy_prompt: string;
  questions: { id: string; order_idx: number; question_text: string; answer_type: string }[];
  rules: {
    id: string;
    order_idx: number;
    action: 'forward' | 'reject';
    condition: { field: string; op: string; value: string };
  }[];
}

export default function RulesPage() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

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

  async function load() {
    if (!token) return;
    const r = await fetch(`${API_URL}/profiles`, { headers: { authorization: `Bearer ${token}` } });
    const d = await r.json();
    setProfile(d.profiles?.[0] ?? null);
  }

  useEffect(() => { if (!token) signInDemo(); }, [token]);
  useEffect(() => { load(); }, [token]);

  async function save() {
    if (!profile || !token) return;
    setSaving(true);
    await fetch(`${API_URL}/profiles/${profile.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: profile.name,
        is_active: profile.is_active,
        language: profile.language,
        greeting_text: profile.greeting_text,
        policy_prompt: profile.policy_prompt,
        questions: profile.questions,
        rules: profile.rules,
      }),
    });
    setSaving(false);
    load();
  }

  if (!profile) return <div className="card">Loading demo profile…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Screening Rules</h1>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="card space-y-4">
        <div>
          <div className="label">Profile name</div>
          <input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
        </div>
        <div>
          <div className="label">Language</div>
          <select className="input" value={profile.language} onChange={(e) => setProfile({ ...profile, language: e.target.value })}>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="hinglish">Hinglish</option>
          </select>
        </div>
        <div>
          <div className="label">Greeting</div>
          <textarea className="input" rows={2} value={profile.greeting_text} onChange={(e) => setProfile({ ...profile, greeting_text: e.target.value })} />
        </div>
        <div>
          <div className="label">Policy (natural language — the LLM reads this)</div>
          <textarea className="input" rows={5} value={profile.policy_prompt} onChange={(e) => setProfile({ ...profile, policy_prompt: e.target.value })} />
        </div>
      </div>

      <div className="card">
        <div className="font-semibold mb-3">Screening Questions</div>
        <div className="space-y-2">
          {profile.questions
            .slice()
            .sort((a, b) => a.order_idx - b.order_idx)
            .map((q, i) => (
              <div key={q.id || i} className="flex gap-2">
                <div className="w-8 text-center text-gatekeep-muted pt-2">{i + 1}.</div>
                <input
                  className="input flex-1"
                  value={q.question_text}
                  onChange={(e) => {
                    const next = [...profile.questions];
                    next[i] = { ...next[i], question_text: e.target.value };
                    setProfile({ ...profile, questions: next });
                  }}
                />
                <select
                  className="input w-40"
                  value={q.answer_type}
                  onChange={(e) => {
                    const next = [...profile.questions];
                    next[i] = { ...next[i], answer_type: e.target.value };
                    setProfile({ ...profile, questions: next });
                  }}
                >
                  <option value="text">Text</option>
                  <option value="yes_no">Yes / No</option>
                </select>
              </div>
            ))}
        </div>
        <button
          className="btn-ghost mt-3"
          onClick={() =>
            setProfile({
              ...profile,
              questions: [
                ...profile.questions,
                { id: '', order_idx: profile.questions.length, question_text: '', answer_type: 'text' },
              ],
            })
          }
        >
          + Add question
        </button>
      </div>

      <div className="card">
        <div className="font-semibold mb-3">Hard Rules (override the LLM)</div>
        <div className="space-y-2">
          {profile.rules.map((r, i) => (
            <div key={r.id || i} className="grid grid-cols-[100px_1fr_100px_1fr_110px] gap-2">
              <span className="pt-2 text-center text-gatekeep-muted">IF</span>
              <select
                className="input"
                value={r.condition.field}
                onChange={(e) => update(i, { condition: { ...r.condition, field: e.target.value as never } })}
              >
                <option value="intent">intent</option>
                <option value="is_existing_patient">is_existing_patient</option>
                <option value="is_emergency">is_emergency</option>
                <option value="caller_text">caller_text</option>
              </select>
              <select className="input" value={r.condition.op} onChange={(e) => update(i, { condition: { ...r.condition, op: e.target.value as never } })}>
                <option value="equals">equals</option>
                <option value="not_equals">not_equals</option>
                <option value="includes">includes</option>
              </select>
              <input className="input" value={r.condition.value} onChange={(e) => update(i, { condition: { ...r.condition, value: e.target.value } })} />
              <select className="input" value={r.action} onChange={(e) => update(i, { action: e.target.value as 'forward' | 'reject' })}>
                <option value="forward">FORWARD</option>
                <option value="reject">REJECT</option>
              </select>
            </div>
          ))}
        </div>
        <button
          className="btn-ghost mt-3"
          onClick={() =>
            setProfile({
              ...profile,
              rules: [
                ...profile.rules,
                { id: '', order_idx: profile.rules.length, action: 'reject', condition: { field: 'intent', op: 'includes', value: '' } },
              ],
            })
          }
        >
          + Add rule
        </button>
      </div>
    </div>
  );

  function update(i: number, patch: Partial<Profile['rules'][number]>) {
    if (!profile) return;
    const next = [...profile.rules];
    next[i] = { ...next[i], ...patch };
    setProfile({ ...profile, rules: next });
  }
}
