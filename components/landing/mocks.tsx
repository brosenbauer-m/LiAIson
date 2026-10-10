// Product pictures for "How it Works" (400 × 440 px each, laid out with
// absolute positions so the diagram lines in slides.ts can point at exact
// spots). Purely illustrative: example people and text.

const frame = 'relative w-[400px] h-[440px] rounded-2xl border border-border bg-card shadow-card overflow-hidden text-text-primary'
const card = 'absolute left-5 right-5 rounded-xl border border-border bg-background px-4 py-3'
const label = 'text-[11px] font-semibold uppercase tracking-wider text-text-muted'

export function VaultMock() {
  return (
    <div className={frame}>
      <p className="absolute left-5 top-4 font-display text-xl">My Vault</p>
      <div className="absolute right-5 top-5 w-28 text-right">
        <p className="text-[11px] text-text-secondary tabular-nums">2,340 / 15,000</p>
        <div className="mt-1 h-1.5 rounded-full bg-accent-subtle"><div className="h-full w-[16%] rounded-full bg-accent" /></div>
      </div>
      <div className="absolute left-5 top-[58px] flex gap-1.5 text-[11px]">
        <span className="rounded-full bg-accent px-2.5 py-1 text-white">Outer Circle</span>
        <span className="rounded-full border border-border px-2.5 py-1 text-text-secondary">Inner Circle</span>
        <span className="rounded-full border border-border px-2.5 py-1 text-text-secondary">Drafts</span>
      </div>
      <div className={card} style={{ top: 100, height: 70 }}>
        <p className={label}>Profile Bio</p>
        <p className="mt-1 text-[12.5px] leading-snug">Product designer in Vienna. Tennis, sailing and good coffee.</p>
      </div>
      <div className={card} style={{ top: 182, height: 80 }}>
        <p className={label}>Hobbies</p>
        <p className="mt-1 text-[12.5px] leading-snug">Tennis twice a week since I was eight. Sailing on the Attersee every summer.</p>
      </div>
      <div className={card} style={{ top: 274, height: 80 }}>
        <p className={label}>Work experience</p>
        <p className="mt-1 text-[12.5px] leading-snug">Senior product designer at a Vienna start-up; five years in agencies before that.</p>
      </div>
      <div className="absolute left-5 right-5 top-[372px] h-11 rounded-xl border-2 border-dashed border-border flex items-center justify-center text-[12.5px] text-text-secondary">
        ↑ Import a file · PDF or Word
      </div>
    </div>
  )
}

export function ChatMock() {
  return (
    <div className={frame}>
      <div className="absolute left-5 right-5 top-4 h-8 rounded-full border border-border bg-background flex items-center px-3 font-mono text-[11.5px] text-text-secondary">
        my-liaison.app/anna
      </div>
      <div className="absolute left-5 top-[60px] flex items-center gap-2.5">
        <span className="h-8 w-8 rounded-full bg-accent text-white flex items-center justify-center font-display">A</span>
        <span>
          <span className="block text-[13px] font-semibold leading-tight">Anna&apos;s LiAIson</span>
          <span className="block text-[11px] text-text-muted">Ask me anything about Anna</span>
        </span>
      </div>
      <div className="absolute left-0 right-0 top-[102px] border-t border-border" />
      <p className="absolute right-5 top-[114px] max-w-[250px] rounded-2xl rounded-br-none bg-accent px-3.5 py-2 text-[12.5px] text-white">
        What does Anna do outside of work?
      </p>
      <p className="absolute left-5 top-[160px] w-[300px] rounded-2xl rounded-bl-none border border-border bg-background px-3.5 py-2.5 text-[12.5px] leading-snug">
        Anna plays tennis twice a week and sails on the Attersee every summer. She has played tennis since childhood,{' '}
        <span className="underline decoration-accent decoration-2 underline-offset-2">just like you!</span>
      </p>
      <p className="absolute left-6 top-[252px] text-[11px] text-text-secondary">✨ See everything you have in common →</p>
      <div className="absolute left-5 right-5 top-[282px] h-[142px] rounded-xl border border-border bg-background px-4 py-3">
        <p className="text-[12px]"><span className="tracking-widest">●●●●○</span> <span className="font-semibold">A lot in common</span></p>
        <span className="absolute left-[40px] top-[56px] h-14 w-14 rounded-full bg-accent text-white text-[11px] flex items-center justify-center">Tennis</span>
        <span className="absolute left-[100px] top-[44px] h-12 w-12 rounded-full bg-accent text-white text-[10px] flex items-center justify-center">Vienna</span>
        <span className="absolute left-[92px] top-[90px] h-10 w-10 rounded-full bg-accent text-white text-[9px] flex items-center justify-center">Design</span>
        <span className="absolute left-[200px] top-[60px] h-11 w-11 rounded-full border border-accent text-[10px] flex items-center justify-center">Sailing</span>
        <span className="absolute left-[250px] top-[86px] h-9 w-9 rounded-full bg-accent-subtle text-[9px] flex items-center justify-center">Jazz</span>
      </div>
    </div>
  )
}

export function CirclesMock() {
  return (
    <div className={frame}>
      <div className="absolute left-5 top-4 inline-flex rounded-full border border-border bg-background p-0.5 text-[11.5px]">
        <span className="rounded-full bg-accent px-3 py-1 text-white">Public</span>
        <span className="px-3 py-1 text-text-secondary">Private</span>
      </div>
      <svg className="absolute left-0 top-0" width="400" height="350" aria-hidden="true">
        <circle cx="175" cy="200" r="130" fill="#F6EFE6" stroke="#5C3B28" strokeOpacity="0.35" />
        <text x="175" y="92" textAnchor="middle" fontSize="11" fill="#8F7B6C" letterSpacing="1.5">OUTER CIRCLE</text>
        <circle cx="175" cy="215" r="62" fill="#5C3B28" />
        <text x="175" y="219" textAnchor="middle" fontSize="11" fill="#FFFFFF" letterSpacing="1.5">INNER</text>
        <circle cx="320" cy="282" r="48" fill="#FFFDF9" stroke="#5C3B28" strokeDasharray="5 3" />
        <text x="320" y="286" textAnchor="middle" fontSize="11" fill="#2B1E16">Family</text>
      </svg>
      <div className="absolute left-5 right-5 top-[352px] h-[74px] rounded-xl border border-border bg-background px-4 py-2.5">
        <p className="text-[12.5px]"><span className="font-semibold">Lena Berger</span> wants to connect</p>
        <div className="mt-2 flex items-center gap-1.5 text-[11px]">
          <span className="rounded-full border border-border px-2.5 py-0.5 text-text-secondary">Outer</span>
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-white">Inner</span>
          <span className="rounded-full border border-dashed border-accent px-2.5 py-0.5">Family</span>
          <span className="ml-auto rounded-lg bg-accent px-3 py-1 text-white">Accept</span>
        </div>
      </div>
    </div>
  )
}

export function DiscoverMock() {
  const result = (top: number, name: string, handle: string, reason: string) => (
    <div className={card} style={{ top, height: 76 }}>
      <div className="flex items-center gap-2.5">
        <span className="h-8 w-8 rounded-full bg-accent-subtle text-accent flex items-center justify-center font-display">{name[0]}</span>
        <span>
          <span className="block text-[13px] font-semibold leading-tight">{name}</span>
          <span className="block text-[11px] text-text-muted">{handle}</span>
        </span>
      </div>
      <p className="mt-1.5 text-[12px] text-text-secondary">{reason}</p>
    </div>
  )
  return (
    <div className={frame}>
      <p className="absolute left-5 top-4 font-display text-xl">Discover</p>
      <div className="absolute left-5 top-[54px] inline-flex rounded-full border border-border bg-background p-0.5 text-[11.5px]">
        <span className="px-3 py-1 text-text-secondary">By name</span>
        <span className="rounded-full bg-accent px-3 py-1 text-white">By Information</span>
      </div>
      <div className="absolute left-5 right-5 top-[96px] h-[42px] rounded-xl border border-border bg-background flex items-center px-4 text-[12.5px]">
        People in Vienna who play tennis
      </div>
      {result(154, 'Anna Berger', '@anna', 'Plays tennis twice a week and lives in Vienna.')}
      {result(240, 'Jonas Weber', '@jonas', 'Lives in Vienna and plays in a tennis club.')}
      <p className="absolute left-5 top-[334px] text-[11px] text-text-muted">18 of 20 searches left this month</p>
      <p className="absolute left-5 top-[352px] text-[11px] text-text-muted">Only people who chose to be findable</p>
    </div>
  )
}

export function EchoesMock() {
  const bars: [string, number][] = [['Work & projects', 40], ['Hobbies', 28], ['What she looks for', 18], ['Values', 14]]
  return (
    <div className={frame}>
      <div className="absolute left-5 right-5 top-4 flex items-center justify-between">
        <p className="flex items-center gap-2">
          <span className="font-display text-xl">Echo</span>
          <span className="rounded-full bg-accent-subtle px-2.5 py-0.5 text-[11px] text-accent">This week</span>
        </p>
        <p className="text-[11px] text-text-secondary">23 questions</p>
      </div>
      <div className="absolute left-5 right-5 top-[70px] space-y-4">
        {bars.map(([name, pct]) => (
          <div key={name}>
            <div className="flex justify-between text-[12px]"><span>{name}</span><span className="text-text-muted tabular-nums">{pct}%</span></div>
            <div className="mt-1 h-2 rounded-full bg-accent-subtle"><div className="h-full rounded-full bg-accent" style={{ width: `${pct * 2}%` }} /></div>
          </div>
        ))}
      </div>
      <div className={card} style={{ top: 266, height: 74 }}>
        <p className="text-[12.5px] italic leading-snug text-text-secondary">People asked most about your sailing trips and what you look for in a new role.</p>
      </div>
      <p className="absolute left-5 top-[364px] text-[11.5px] text-text-secondary">🔒 Never who asked or their exact words</p>
    </div>
  )
}

export function CostMock() {
  const row = (top: number, left: string, right: string) => (
    <div className="absolute left-5 right-5 flex justify-between border-b border-border pb-2 text-[12.5px]" style={{ top }}>
      <span className="text-text-secondary">{left}</span>
      <span className="tabular-nums">{right}</span>
    </div>
  )
  return (
    <div className={frame}>
      <p className="absolute left-5 top-4 text-[11px] uppercase tracking-wider text-text-muted">This month</p>
      <p className="absolute left-5 top-8 font-display text-4xl">€1.24</p>
      <p className="absolute right-5 top-[46px] text-[12px] text-text-secondary">112 messages</p>
      <div className="absolute left-5 right-5 top-[106px]">
        <div className="flex justify-between text-[12px]"><span className="text-text-secondary">Spending limit</span><span className="tabular-nums">€1.24 of €15</span></div>
        <div className="mt-1.5 h-2 rounded-full bg-accent-subtle"><div className="h-full w-[8%] rounded-full bg-accent" /></div>
      </div>
      {row(172, 'Average per message', '1.1 ct')}
      {row(214, 'Charged on', '1 November')}
      {row(256, 'Extrovert', '€6 / month')}
      <div className="absolute left-5 right-5 top-[320px] h-[86px] rounded-xl bg-accent-tint px-4 py-3">
        <p className="text-[12px] text-text-secondary">Others talking to your LiAIson</p>
        <p className="font-display text-3xl mt-1">€0.00</p>
      </div>
    </div>
  )
}
