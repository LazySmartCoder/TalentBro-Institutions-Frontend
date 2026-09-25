import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  CalendarCheck,
  Check,
  ChevronRight,
  Command,
  FileWarning,
  GraduationCap,
  MessageCircleMore,
  Radar,
  Search,
  Sparkles,
  Target,
  UsersRound,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import heroImage from "@/assets/talentbro-hero.jpg";
import studentImage from "@/assets/student-prep.jpg";
import placementImage from "@/assets/placement-cell.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TalentBro Institutions — Campus talent, ready for what’s next" },
      {
        name: "description",
        content: "AI-powered placement preparation for students and actionable talent intelligence for placement cells.",
      },
      { property: "og:title", content: "TalentBro Institutions — Placement readiness, connected" },
      {
        property: "og:description",
        content: "Prepare every student. Understand every skill. Run every placement drive with confidence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TalentBroPage,
});

const studentSkills = ["AI Training", "Mock Interviews", "Group Discussions", "Communication", "Aptitude", "Technical / DSA"];
const institutionTools = ["Student intelligence", "Skill-gap insights", "Eligibility matching", "Placement analytics", "Drive management", "AI talent search"];

function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      const started = performance.now();
      const run = (now: number) => {
        const progress = Math.min((now - started) / 1300, 1);
        setCount(Math.round(value * (1 - Math.pow(1 - progress, 3))));
        if (progress < 1) requestAnimationFrame(run);
      };
      requestAnimationFrame(run);
      observer.disconnect();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);

  return <span ref={ref}>{count}{suffix}</span>;
}

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) node.dataset["visible"] = "true";
    }, { threshold: 0.15 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${className}`}>{children}</div>;
}

function Logo() {
  return (
    <a href="#top" className="group flex items-center gap-2" aria-label="TalentBro home">
      <span className="text-sm font-bold">TalentBro <span className="font-medium text-muted-foreground">Institutions</span></span>
    </a>
  );
}

function TalentBroPage() {
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const move = (event: PointerEvent) => {
      const bounds = hero.getBoundingClientRect();
      hero.style.setProperty("--hero-x", `${((event.clientX - bounds.left) / bounds.width - 0.5) * 2}`);
      hero.style.setProperty("--hero-y", `${((event.clientY - bounds.top) / bounds.height - 0.5) * 2}`);
    };
    const reset = () => {
      hero.style.setProperty("--hero-x", "0");
      hero.style.setProperty("--hero-y", "0");
    };

    hero.addEventListener("pointermove", move);
    hero.addEventListener("pointerleave", reset);
    return () => {
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", reset);
    };
  }, []);

  return (
    <main id="top" className="overflow-hidden bg-background text-foreground">
      <section ref={heroRef} className="hero-shell relative min-h-[700px] bg-ink text-paper lg:min-h-screen">
        <nav className="relative z-30 mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 md:px-10 lg:px-14">
          <div className="hero-status hidden items-center gap-3 md:flex lg:absolute lg:left-1/2 lg:-translate-x-1/2"><span className="live-dot" /> AI FOR/BY TOP INSTITUTIONAL PLACEMENT CELLS</div>
          <Link to="/get-started" className="hero-enter group ml-auto" aria-label="Book a TalentBro walkthrough">ENTER <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></Link>
        </nav>

        <div className="hero-word hero-word-top" aria-hidden="true">TALENT</div>
        <div className="hero-word hero-word-bottom" aria-hidden="true">BRO</div>
        <div className="hero-stage" aria-hidden="true">
          <div className="hero-image">
            <img src={heroImage} width={1920} height={1200} alt="" className="h-full w-full object-cover object-[68%_center]" />
          </div>
          <div className="hero-image-echo hero-image-echo-one"><img src={heroImage} alt="" /></div>
          <div className="hero-image-echo hero-image-echo-two"><img src={heroImage} alt="" /></div>
          <div className="scanner-line" />
        </div>

        <div className="hero-radar" aria-hidden="true">
          <span className="radar-ring radar-ring-one" /><span className="radar-ring radar-ring-two" /><span className="radar-ring radar-ring-three" />
          <span className="radar-axis radar-axis-x" /><span className="radar-axis radar-axis-y" />
        </div>
        <div className="hero-grain" aria-hidden="true" />
        <div className="hero-grid" aria-hidden="true" />

        <div className="hero-center-copy">
          <h1><span>Placement Competition</span><span>begins here.</span></h1>
        </div>

        <div className="orbit-label orbit-label-one"><span>87</span> READINESS</div>
        <div className="orbit-label orbit-label-two">AI / LIVE <span>●</span></div>
        <div className="orbit-label orbit-label-three">24 MATCHES</div>
        <div className="orbit-label orbit-label-four">SKILL +12</div>

        <a href="#proof" className="scroll-cue" aria-label="Explore TalentBro"><ArrowDown className="size-4" /></a>
      </section>

      <section className="search-stage bg-paper px-5 pb-16 pt-12 text-ink md:px-10 lg:px-14 lg:pb-24 lg:pt-16">
        <Reveal className="mx-auto max-w-5xl text-center">
          <h2 className="section-title mx-auto max-w-4xl">Find the right students<br />before the company asks.</h2>
          <div className="command-box mx-auto mt-12 max-w-4xl text-left">
            <div className="flex items-center gap-3 border-b border-ink/10 px-5 py-4 text-xs text-ink/45"><Command className="size-4" /> Talent intelligence</div>
            <div className="flex items-start gap-4 px-5 py-6 md:items-center md:px-8">
              <Search className="mt-1 size-5 shrink-0 md:mt-0" />
              <p className="query-text">“Show final-year students with Java, 75%+ aptitude and strong communication.”<span className="cursor-blink" /></p>
              <ArrowRight className="ml-auto hidden size-5 md:block" />
            </div>
            <div className="result-row"><div className="avatar-stack"><span>AK</span><span>RM</span><span>NS</span><span>+21</span></div><div><strong>24 students matched</strong><p>Across CSE, IT and ECE • Ready to shortlist</p></div><button aria-label="Open matching students"><ArrowRight className="size-4" /></button></div>
          </div>
        </Reveal>
      </section>

      <section id="proof" className="relative bg-paper px-5 py-16 text-ink md:px-10 lg:px-14">
        <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-y-10 md:grid-cols-4">
          {[[92, "%", "student engagement"], [3, "×", "faster shortlisting"], [40, "%", "less coordination"], [1, "", "connected talent view"]].map(([value, suffix, label]) => (
            <div key={label as string} className="metric px-3 md:px-8"><div><Counter value={value as number} suffix={suffix as string} /></div><p>{label}</p></div>
          ))}
        </div>
      </section>

      <section id="pillars" className="relative bg-ink px-5 py-24 text-paper md:px-10 lg:px-14 lg:py-40">
        <div className="mx-auto max-w-[1400px]">
          <Reveal>
            <p className="eyebrow eyebrow-dark">The placement fundamentals</p>
            <h2 className="section-title">Four pillars decide<br /><span className="text-paper/40">who gets placed.</span></h2>
            <p className="section-copy text-paper/55">Every recruiter reads the same four signals. Your command over each one is what your campus truly offers.</p>
          </Reveal>

          <div className="mt-16 grid gap-4 md:grid-cols-3">
            {[
              [GraduationCap, "CGPA", "The King", "Your academic command — the baseline almost every recruiter checks first."],
              [CalendarCheck, "Attendance", "The Public", "Presence and consistency — proof the student shows up, term after term."],
              [FileWarning, "Backlogs", "The Debt", "Unresolved subjects pull offers down. Clearing them unlocks eligibility."],
            ].map(([Icon, title, rank, copy]) => {
              const PillarIcon = Icon as typeof GraduationCap;
              return (
                <Reveal key={title as string} className="rounded-md border border-paper/15 bg-paper/[0.06] p-6 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <PillarIcon className="size-5 text-paper/70" />
                    <span className="rounded-full border border-paper/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-paper/60">{rank as string}</span>
                  </div>
                  <h3 className="mt-8 text-2xl font-semibold">{title as string}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-paper/55">{copy as string}</p>
                </Reveal>
              );
            })}
          </div>

          <Reveal className="mt-4 rounded-md bg-paper p-7 text-ink md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
              <div className="flex items-center gap-4">
                <span className="grid size-14 shrink-0 place-items-center rounded-md bg-ink text-paper"><Radar className="size-6" /></span>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-ink/45">The Commander · most significant</span>
                  <h3 className="mt-1 text-2xl font-semibold md:text-3xl">Skill Recognition &amp; Mapping</h3>
                </div>
              </div>
              <p className="max-w-xl text-sm leading-relaxed text-ink/65 lg:ml-auto lg:text-right">
                The decisive pillar. It turns everything else into a placement engine — know what your students can actually do, and let that be the basis of every drive.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="students" className="curve-section bg-background px-5 pb-24 pt-28 md:px-10 lg:px-14 lg:py-36">
        <div className="mx-auto grid max-w-[1400px] items-center gap-16 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal className="relative">
            <div className="photo-arch photo-arch-left"><img src={studentImage} loading="lazy" width={1408} height={1008} alt="Students collaborating during technical preparation" /></div>
            <div className="readiness-ring"><span>84</span><small>readiness</small></div>
            <div className="floating-label">+12% this month <ArrowRight className="size-3" /></div>
          </Reveal>
          <Reveal>
            <h2 className="section-title">Practice that feels real.<br />Feedback that makes you better.</h2>
            <p className="section-copy">Students build confidence across every placement stage with adaptive practice, direct feedback and a readiness score they can act on.</p>
            <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
              {studentSkills.map((skill, index) => (
                <div key={skill} className="feature-tile group"><span>0{index + 1}</span><p>{skill}</p><ChevronRight className="size-4 transition-transform group-hover:translate-x-1" /></div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section id="institutions" className="relative bg-ink px-5 py-28 text-paper md:px-10 lg:px-14 lg:py-40">
        <div className="institution-curve" aria-hidden="true" />
        <div className="relative z-10 mx-auto grid max-w-[1400px] items-center gap-16 lg:grid-cols-[1.05fr_0.95fr]">
          <Reveal className="lg:pr-12">
            <h2 className="section-title">See the Talent.<br /><span className="text-paper/40">Stop the guesswork.</span></h2>
            <p className="section-copy text-paper/55">Turn scattered student information into a clear, live view of skills, readiness and opportunity—without the spreadsheet chase.</p>
            <div className="mt-9 grid gap-3 sm:grid-cols-2">
              {institutionTools.map((tool) => <div key={tool} className="dark-feature"><Check className="size-4" />{tool}</div>)}
            </div>
          </Reveal>
          <Reveal className="relative">
            <div className="photo-arch photo-arch-right"><img src={placementImage} loading="lazy" width={1408} height={1008} alt="Placement team reviewing student analytics" /></div>
            <div className="analytics-float">
              <div className="flex justify-between text-[10px] uppercase text-paper/45"><span>Batch readiness</span><span>Live</span></div>
              <div className="mt-5 flex items-end justify-between"><strong className="text-4xl">78%</strong><div className="mini-bars">{[38, 65, 48, 82, 71, 94].map((h) => <i key={h} style={{ height: `${h}%` }} />)}</div></div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="outcomes" className="outcome-section relative bg-background px-5 py-28 md:px-10 lg:px-14 lg:py-40">
        <div className="mx-auto max-w-[1400px]">
          <Reveal><p className="eyebrow">The placement flywheel</p><h2 className="section-title max-w-4xl">Better preparation builds<br />better campus relationships.</h2></Reveal>
          <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              [Target, "01", "Better-prepared students", "Focused practice turns uncertainty into measurable readiness."],
              [BrainCircuit, "02", "Less placement-cell workload", "Automation replaces manual follow-ups and fragmented data."],
              [MessageCircleMore, "03", "Stronger company trust", "Clear talent signals make every recruiter conversation credible."],
              [UsersRound, "04", "More returning companies", "Better hiring experiences build relationships year after year."],
            ].map(([Icon, number, title, copy]) => {
              const OutcomeIcon = Icon as typeof Target;
              return <Reveal key={title as string} className="outcome-card"><div className="flex items-center justify-between"><OutcomeIcon className="size-5" /><span>{number as string}</span></div><h3>{title as string}</h3><p>{copy as string}</p></Reveal>;
            })}
          </div>
        </div>
      </section>

      <section id="contact" className="cta-section bg-ink px-5 py-24 text-center text-paper md:px-10 lg:py-36">
        <Reveal className="relative z-10 mx-auto max-w-4xl">
          <span className="mx-auto grid size-12 place-items-center rounded-full border border-paper/20"><Sparkles className="size-5" /></span>
          <h2 className="mt-8 text-4xl font-semibold leading-tight md:text-6xl lg:text-7xl">Make every student<br />placement-ready.</h2>
          <p className="mx-auto mt-6 max-w-xl text-paper/55">See how TalentBro can turn your campus talent into a clear, confident, recruiter-ready pipeline.</p>
          <Link to="/sandbox" className="cta-light cta-large group mt-9">Book an institutional walkthrough <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></Link>
        </Reveal>
      </section>

      <footer className="bg-ink px-5 pb-8 text-paper md:px-10 lg:px-14"><div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-5 border-t border-paper/10 pt-8 sm:flex-row"><Logo /><div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs"><Link to="/tac" className="text-paper/45 transition-colors hover:text-paper">Terms &amp; Conditions</Link><Link to="/privacy-policy" className="text-paper/45 transition-colors hover:text-paper">Privacy Policy</Link><p className="text-paper/35">© 2026 TalentBro. Built for better placements.</p></div></div></footer>
    </main>
  );
}