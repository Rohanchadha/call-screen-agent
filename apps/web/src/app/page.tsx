export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          Only the <span className="text-gatekeep-accent">real calls</span> get through.
        </h1>
        <p className="text-gatekeep-muted max-w-2xl">
          Gatekeep is an AI receptionist that screens every call from an unknown number.
          It asks the caller why they&apos;re calling, applies the rules you set, and either
          forwards the call to you with a summary — or politely declines.
        </p>
        <div className="flex gap-3">
          <a href="/simulator" className="btn-primary">Open Call Simulator</a>
          <a href="/rules" className="btn-ghost">Edit Screening Rules</a>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        {[
          { t: 'Doctor template', d: 'Emergency-aware rules pre-configured for clinics.' },
          { t: 'English • Hindi • Hinglish', d: 'The agent replies in the caller\'s language.' },
          { t: 'Known contacts bypass', d: 'Saved numbers ring through without screening.' },
        ].map((c) => (
          <div key={c.t} className="card">
            <div className="text-lg font-semibold">{c.t}</div>
            <div className="text-sm text-gatekeep-muted mt-1">{c.d}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
