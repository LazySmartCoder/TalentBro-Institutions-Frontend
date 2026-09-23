import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/* ---------------------------------- shell --------------------------------- */

export function Panel({
  children,
  className,
  label,
  tabs,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
  tabs?: string[];
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-panel)]",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-border bg-secondary/60 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-foreground/20" />
          <span className="h-2 w-2 rounded-full bg-foreground/15" />
          <span className="h-2 w-2 rounded-full bg-foreground/10" />
        </div>
        {label ? (
          <span className="truncate font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            {label}
          </span>
        ) : null}
        {tabs ? (
          <div className="ml-auto hidden gap-1 sm:flex">
            {tabs.map((t, i) => (
              <span
                key={t}
                className={cn(
                  "rounded-md px-2 py-1 text-[10px] font-medium",
                  i === 0
                    ? "bg-foreground text-background"
                    : "text-muted-foreground ring-1 ring-border",
                )}
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

export function Stat({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
      {sub ? <div className="mt-2 text-[10px] font-medium">{sub}</div> : null}
    </div>
  );
}

function Bar({ v, i = 0 }: { v: number; i?: number }) {
  return (
    <div className="flex h-full w-full items-end">
      <div
        className="w-full origin-bottom rounded-t-[3px] bg-foreground/85 animate-grow"
        style={{ height: `${v}%`, animationDelay: `${i * 60}ms` }}
      />
    </div>
  );
}

/* --------------------------------- hero ----------------------------------- */

export function ReadinessGauge({ score = 74 }: { score?: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-5">
      <div className="relative">
        <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
          <circle
            cx="66"
            cy="66"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-muted"
          />
          <circle
            cx="66"
            cy="66"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            className="text-foreground"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - score / 100)}
            style={{ transition: "stroke-dashoffset 1.2s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tracking-tight">{score}</span>
          <span className="text-[10px] tracking-widest text-muted-foreground uppercase">Ready</span>
        </div>
      </div>
      <div className="grid flex-1 gap-2">
        {[
          ["Placement ready", 412],
          ["Near ready", 356],
          ["Needs work", 232],
        ].map(([l, n], i) => (
          <div key={l as string} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-[11px] text-muted-foreground">{l}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground animate-grow"
                style={{ width: `${(n as number) / 4.5}%`, opacity: 1 - i * 0.28 }}
              />
            </div>
            <span className="w-9 text-right font-mono text-[11px]">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeroVisual() {
  return (
    <div className="grid gap-4">
      <Panel
        label="talentbro / cohort 2026 — readiness"
        tabs={["Overview", "Departments", "Companies"]}
      >
        <div className="grid gap-5 sm:grid-cols-[1.1fr_1fr]">
          <ReadinessGauge />
          <div className="grid grid-cols-2 gap-2">
            <Stat value="1,000" label="Students tracked" />
            <Stat value="86%" label="Mock participation" />
            <Stat value="12" label="Departments" />
            <Stat value="24" label="Target companies" />
          </div>
        </div>
        <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-[2fr_1fr]">
          <div>
            <div className="eyebrow">Readiness trend · 8 weeks</div>
            <div className="mt-3 flex h-24 items-end gap-1.5">
              {[34, 41, 39, 48, 55, 61, 68, 74].map((v, i) => (
                <Bar key={i} v={v} i={i} />
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="eyebrow">Live now</div>
            <ul className="mt-2 space-y-2 text-[11px]">
              {["Mock interview · Deloitte", "Skill mapping · CSE-B", "Report generated"].map(
                (t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground animate-pulse-soft" />
                    <span className="text-muted-foreground">{t}</span>
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>
      </Panel>
    </div>
  );
}

/* -------------------------------- problem --------------------------------- */

export function StudentDotGrid() {
  const cells = Array.from({ length: 240 });
  return (
    <Panel label="visibility gap · 1,000 students">
      <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-1.5">
        {cells.map((_, i) => {
          const known = i % 7 === 0;
          return (
            <span
              key={i}
              className={cn(
                "aspect-square rounded-[2px]",
                known ? "bg-foreground" : "bg-foreground/10",
              )}
              style={
                known
                  ? { animation: `pulse-soft ${2 + (i % 5) * 0.4}s ease-in-out infinite` }
                  : undefined
              }
            />
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-5 border-t border-border pt-4 text-[11px]">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-foreground" /> Measured readiness · 14%
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-foreground/10" /> Unknown · 86%
        </span>
      </div>
    </Panel>
  );
}

/* -------------------------------- journey --------------------------------- */

const JOURNEY = [
  "Create Cohort",
  "Skill Mapping Interview",
  "Readiness Profile",
  "Personalized Recommendations",
  "Company-Specific Mock Interviews",
  "Continuous Assessment",
  "Rankings",
  "Placement Intelligence",
  "Placement Drive",
];

export function JourneyRail() {
  return (
    <ol className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
      {JOURNEY.map((step, i) => (
        <li key={step} className="group relative bg-card p-5 transition-colors hover:bg-secondary">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[11px] text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="h-px w-10 bg-border transition-all group-hover:w-16 group-hover:bg-foreground" />
          </div>
          <div className="mt-6 text-sm font-medium leading-snug">{step}</div>
          <div className="mt-3 flex gap-1">
            {Array.from({ length: 9 }).map((_, k) => (
              <span
                key={k}
                className={cn("h-1 flex-1 rounded-full", k <= i ? "bg-foreground" : "bg-muted")}
              />
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------ skill mapping ----------------------------- */

const SKILLS: [string, number][] = [
  ["Technical", 82],
  ["Communication", 68],
  ["Problem Solving", 76],
  ["Behavioral", 71],
  ["Aptitude", 88],
  ["Interview Performance", 64],
];

export function SkillRadar() {
  const n = SKILLS.length;
  const cx = 130;
  const cy = 125;
  const R = 100;
  const pt = (i: number, f: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f];
  };
  const poly = SKILLS.map(([, v], i) => pt(i, v / 100).join(",")).join(" ");
  return (
    <Panel label="ai skill mapping · radar">
      <svg viewBox="0 0 260 250" className="mx-auto w-full max-w-[360px]">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon
            key={f}
            points={SKILLS.map((_, i) => pt(i, f).join(",")).join(" ")}
            fill="none"
            stroke="currentColor"
            className="text-border"
          />
        ))}
        {SKILLS.map((_, i) => {
          const [x, y] = pt(i, 1);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="currentColor"
              className="text-border"
            />
          );
        })}
        <polygon points={poly} className="fill-foreground/12 stroke-foreground" strokeWidth="2" />
        {SKILLS.map(([, v], i) => {
          const [x, y] = pt(i, v / 100);
          return <circle key={i} cx={x} cy={y} r="3.5" className="fill-foreground" />;
        })}
      </svg>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {SKILLS.map(([label, v]) => (
          <div key={label} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-[11px] text-muted-foreground">{label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground animate-grow"
                style={{ width: `${v}%` }}
              />
            </div>
            <span className="w-7 text-right font-mono text-[11px]">{v}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* --------------------------- personalized prep ---------------------------- */

export function StudentProfileCard() {
  return (
    <Panel label="student profile · A. Menon · CSE" tabs={["Profile", "Roadmap"]}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <div className="eyebrow">Strengths</div>
          <ul className="mt-2 space-y-2 text-[12px]">
            {["Data structures · 88", "Aptitude · 84", "Written clarity · 80"].map((s) => (
              <li
                key={s}
                className="flex items-center justify-between border-b border-border pb-1.5 last:border-0"
              >
                <span>{s.split(" · ")[0]}</span>
                <span className="font-mono text-[11px]">{s.split(" · ")[1]}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="eyebrow">Weaknesses</div>
          <ul className="mt-2 space-y-2 text-[12px]">
            {["System design · 51", "Spoken fluency · 57", "STAR answers · 60"].map((s) => (
              <li
                key={s}
                className="flex items-center justify-between border-b border-border pb-1.5 last:border-0"
              >
                <span>{s.split(" · ")[0]}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {s.split(" · ")[1]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-border p-3">
        <div className="eyebrow">Improvement roadmap · 6 weeks</div>
        <div className="mt-3 space-y-2.5">
          {[
            ["Week 1–2", "System design fundamentals", 100],
            ["Week 3", "Mock interview · behavioral", 70],
            ["Week 4–5", "Company drills · Deloitte, IBM", 40],
            ["Week 6", "Final readiness assessment", 10],
          ].map(([w, t, p]) => (
            <div key={t as string} className="grid grid-cols-[64px_1fr] items-center gap-3">
              <span className="font-mono text-[10px] text-muted-foreground">{w}</span>
              <div>
                <div className="text-[12px]">{t}</div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground animate-grow"
                    style={{ width: `${p}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/* --------------------------- company preparation -------------------------- */

const COMPANIES = [
  "Deloitte",
  "IBM",
  "Google",
  "Accenture",
  "TCS",
  "Infosys",
  "Capgemini",
  "Wipro",
  "Cognizant",
  "EY",
];

export function CompanyMarquee() {
  return (
    <div className="relative overflow-hidden border-y border-border py-5">
      <div className="flex w-max animate-marquee gap-12 pr-12">
        {[...COMPANIES, ...COMPANIES].map((c, i) => (
          <span
            key={i}
            className="text-lg font-medium tracking-tight text-muted-foreground whitespace-nowrap"
          >
            {c}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}

export function CompanyReadinessTable() {
  const rows: [string, number, string][] = [
    ["Deloitte", 78, "Sep 12"],
    ["IBM", 71, "Sep 19"],
    ["Google", 44, "Oct 02"],
    ["Accenture", 83, "Oct 10"],
  ];
  return (
    <Panel label="company simulations · readiness" tabs={["Upcoming", "Past"]}>
      <div className="divide-y divide-border">
        {rows.map(([c, v, d]) => (
          <div key={c} className="grid grid-cols-[1fr_auto] items-center gap-4 py-3">
            <div>
              <div className="flex items-center gap-2 text-[13px] font-medium">
                <span className="grid h-6 w-6 place-items-center rounded border border-border font-mono text-[10px]">
                  {c[0]}
                </span>
                {c}
                <span className="font-mono text-[10px] text-muted-foreground">drive {d}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground animate-grow"
                  style={{ width: `${v}%` }}
                />
              </div>
            </div>
            <span className="font-mono text-sm">{v}%</span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 rounded-lg bg-secondary p-3 text-[11px] sm:grid-cols-3">
        {["Role-specific rounds", "Company question banks", "Recruiter-style rubric"].map((t) => (
          <span key={t} className="text-muted-foreground">
            — {t}
          </span>
        ))}
      </div>
    </Panel>
  );
}

/* ------------------------- continuous improvement ------------------------- */

const LOOP = ["Practice", "Interview", "Analysis", "Feedback", "Improve", "Repeat"];

export function ImprovementLoop() {
  return (
    <Panel label="continuous improvement loop">
      <div className="flex flex-wrap items-center gap-2">
        {LOOP.map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-medium",
                i === LOOP.length - 1
                  ? "bg-foreground text-background"
                  : "border border-border bg-card",
              )}
            >
              {s}
            </span>
            {i < LOOP.length - 1 ? <span className="text-muted-foreground">→</span> : null}
          </span>
        ))}
      </div>
      <div className="mt-5">
        <div className="eyebrow">Performance progression · 10 attempts</div>
        <svg viewBox="0 0 420 140" className="mt-3 w-full">
          {[0, 35, 70, 105].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y + 10}
              x2="420"
              y2={y + 10}
              stroke="currentColor"
              className="text-border"
            />
          ))}
          <polyline
            points="10,120 55,108 100,110 145,92 190,80 235,72 280,58 325,44 370,34 410,22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-foreground"
          />
          <polyline
            points="10,120 55,108 100,110 145,92 190,80 235,72 280,58 325,44 370,34 410,22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray="6 240"
            className="text-foreground/40 animate-dash"
          />
          {[
            [10, 120],
            [145, 92],
            [280, 58],
            [410, 22],
          ].map(([x, y]) => (
            <circle
              key={x}
              cx={x}
              cy={y}
              r="4"
              className="fill-background stroke-foreground"
              strokeWidth="2.5"
            />
          ))}
        </svg>
        <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>Attempt 1 · 42</span>
          <span>Attempt 10 · 81</span>
        </div>
      </div>
    </Panel>
  );
}

/* -------------------------------- rankings -------------------------------- */

export function RankingCard() {
  return (
    <Panel label="rankings · A. Menon" tabs={["University", "Department", "Skill"]}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-foreground bg-foreground p-4 text-background">
          <div className="text-[10px] tracking-widest uppercase opacity-70">University rank</div>
          <div className="mt-2 text-4xl font-semibold tracking-tight">#32</div>
          <div className="text-[11px] opacity-70">of 1,000 students</div>
        </div>
        <Stat value="#7" label="Department rank · CSE" sub="of 180" />
        <Stat value="#3" label="Skill rank · Aptitude" sub="Top 1%" />
      </div>
      <div className="mt-4 divide-y divide-border">
        {[
          ["Technical", "#41"],
          ["Communication", "#212"],
          ["Problem Solving", "#58"],
          ["Behavioral", "#96"],
        ].map(([s, r]) => (
          <div key={s} className="flex items-center justify-between py-2.5 text-[12px]">
            <span className="text-muted-foreground">{s}</span>
            <span className="font-mono">{r}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ------------------------------- dashboard -------------------------------- */

function Heat({ v }: { v: number }) {
  return (
    <div
      className="aspect-square rounded-[3px] bg-foreground"
      style={{ opacity: 0.08 + v * 0.9 }}
      title={`${Math.round(v * 100)}`}
    />
  );
}

export function OfficerDashboard() {
  const depts = ["CSE", "ECE", "MECH", "EEE", "CIVIL", "IT"];
  return (
    <Panel
      label="placement officer dashboard"
      tabs={["Cohort", "Analytics", "Heatmap", "Reports"]}
      className="shadow-[var(--shadow-lift)]"
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat value="1,000" label="Cohort size" />
            <Stat value="74" label="Avg readiness" />
            <Stat value="86%" label="Mock participation" />
            <Stat value="232" label="At risk" />
          </div>
          <div className="flex flex-1 flex-col rounded-lg border border-border p-3">
            <div className="eyebrow">Department analytics · avg readiness</div>
            <div className="mt-3 flex h-28 flex-1 items-end gap-2">
              {[81, 72, 64, 69, 58, 77].map((v, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center gap-2">
                  <Bar v={v} i={i} />
                  <span className="font-mono text-[9px] text-muted-foreground">{depts[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-4">
          <div className="rounded-lg border border-border p-3">
            <div className="eyebrow">Skill heatmap · department × skill</div>
            <div className="mt-3 grid grid-cols-[42px_repeat(6,minmax(0,1fr))] items-center gap-1.5">
              {depts.map((d, r) => (
                <div key={d} className="contents">
                  <span className="font-mono text-[9px] text-muted-foreground">{d}</span>
                  {Array.from({ length: 6 }).map((_, c) => (
                    <Heat key={c} v={((r * 7 + c * 13) % 10) / 10} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="eyebrow">Student progress</div>
            <div className="mt-2 divide-y divide-border">
              {[
                ["A. Menon", "CSE", 81, "+12"],
                ["R. Iyer", "ECE", 66, "+7"],
                ["S. Kaur", "IT", 58, "+3"],
                ["D. Rao", "MECH", 47, "−2"],
              ].map(([n, d, s, delta]) => (
                <div
                  key={n as string}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2 text-[12px]"
                >
                  <span>
                    {n} <span className="text-muted-foreground">· {d}</span>
                  </span>
                  <div className="h-1 w-16 overflow-hidden rounded-full bg-muted sm:w-24">
                    <div className="h-full rounded-full bg-foreground" style={{ width: `${s}%` }} />
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">{delta}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------ intervention ------------------------------ */

export function InterventionFlow() {
  const steps: [string, string][] = [
    ["Identify", "232 students below readiness threshold"],
    ["Recommend", "AI maps the exact skill gap per student"],
    ["Assign", "Preparation modules & company drills"],
    ["Track", "Improvement measured every cycle"],
  ];
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {steps.map(([t, d], i) => (
        <div key={t} className="bg-card p-5">
          <span className="font-mono text-[11px] text-muted-foreground">0{i + 1}</span>
          <div className="mt-5 text-sm font-medium">{t}</div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{d}</p>
          <div className="mt-4 flex h-10 items-end gap-1">
            {[30, 45, 40, 60, 72, 85].slice(0, 3 + i).map((v, k) => (
              <Bar key={k} v={v} i={k} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- reports -------------------------------- */

export function ReportsGrid() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel label="interview transcript" className="lg:col-span-1">
        <div className="space-y-3 text-[12px]">
          {[
            ["AI", "Walk me through how you'd scale a read-heavy service."],
            ["Student", "I'd start with caching and read replicas…"],
            ["AI", "Good. What breaks first under 10× traffic?"],
          ].map(([who, line], i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg p-2.5",
                who === "AI" ? "bg-secondary" : "border border-border",
              )}
            >
              <div className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                {who}
              </div>
              <p className="mt-1 leading-relaxed">{line}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
          {[
            ["Depth", "72"],
            ["Clarity", "68"],
            ["Structure", "81"],
          ].map(([l, v]) => (
            <div key={l}>
              <div className="text-lg font-semibold">{v}</div>
              <div className="text-[10px] text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel label="department analytics" className="lg:col-span-1">
        <div className="eyebrow">Readiness distribution</div>
        <div className="mt-4 flex h-40 items-end gap-1.5">
          {[8, 14, 22, 34, 48, 62, 78, 90, 71, 52, 36, 20].map((v, i) => (
            <Bar key={i} v={v} i={i} />
          ))}
        </div>
        <div className="mt-3 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>0</span>
          <span>Readiness score</span>
          <span>100</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat value="74" label="Median" />
          <Stat value="±11" label="Std deviation" />
        </div>
      </Panel>

      <Panel label="placement report · exportable">
        <div className="divide-y divide-border">
          {[
            ["Student readiness reports", "1,000 PDFs"],
            ["Interview transcripts", "4,820 sessions"],
            ["Department analytics", "12 departments"],
            ["Company readiness", "24 companies"],
            ["Placement outcome report", "Season 2026"],
          ].map(([t, m]) => (
            <div key={t} className="flex items-center justify-between py-3 text-[12px]">
              <span>{t}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{m}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg bg-foreground p-3 text-background">
          <div className="text-[10px] tracking-widest uppercase opacity-70">
            Placement intelligence
          </div>
          <p className="mt-1 text-[12px] leading-relaxed opacity-90">
            Every metric traceable from a single student answer to institution-wide outcomes.
          </p>
        </div>
      </Panel>
    </div>
  );
}
