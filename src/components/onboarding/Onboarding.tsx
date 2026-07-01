import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import confetti from "canvas-confetti";
import { useServerFn } from "@tanstack/react-start";
import jobbyistLogo from "@/assets/jobbyist-logo.png";
import sprintLogo from "@/assets/sprint-logo.jpeg";
import sprintIllustration from "@/assets/sprint-illustration.png";
import { generateSprintAnalysis, type SprintAnalysis } from "@/lib/sprint-analysis.functions";

// ---------- Types ----------
type Answers = {
  profile?: string;
  duration?: string;
  appsPerWeek?: string;
  interviews?: string;
  challenges: string[];
  industries: string[];
  location?: string;
  salary: number;
  commitment: number;
  goals: string[];
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
};

const DEFAULT_ANSWERS: Answers = {
  challenges: [],
  industries: [],
  salary: 25000,
  commitment: 8,
  goals: [],
};

const STORAGE_KEY = "jobbyist_sprint_onboarding_v1";

// ---------- Step registry ----------
type StepId =
  | "welcome"
  | "q-profile"
  | "q-duration"
  | "q-apps"
  | "q-interviews"
  | "q-challenges"
  | "q-industries"
  | "q-location"
  | "q-salary"
  | "q-commitment"
  | "q-goals"
  | "ai-personalising"
  | "labour-market"
  | "methodology"
  | "motivation"
  | "offer"
  | "social-proof"
  | "account"
  | "payment"
  | "success";

const STEPS: StepId[] = [
  "welcome",
  "q-profile",
  "q-duration",
  "q-apps",
  "q-interviews",
  "q-challenges",
  "q-industries",
  "q-location",
  "q-salary",
  "q-commitment",
  "q-goals",
  "ai-personalising",
  "labour-market",
  "methodology",
  "motivation",
  "offer",
  "social-proof",
  "account",
  "payment",
  "success",
];

// ---------- Animated number ----------
function Counter({ to, suffix = "", duration = 1.6 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration: duration * 1000, bounce: 0 });
  const rounded = useTransform(spring, (v) => `${Math.round(v).toLocaleString()}${suffix}`);
  useEffect(() => {
    if (inView) mv.set(to);
  }, [inView, to, mv]);
  return <motion.span ref={ref}>{rounded}</motion.span>;
}

// ---------- Reusable bits ----------
function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow"
        initial={false}
        animate={{ width: `${value}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 22 }}
      />
    </div>
  );
}

function StepShell({
  children,
  onBack,
  progress,
  showHeader = true,
}: {
  children: React.ReactNode;
  onBack?: () => void;
  progress: number;
  showHeader?: boolean;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {showHeader && (
        <header className="sticky top-0 z-30 glass">
          <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 pt-3 pb-2 sm:px-6">
            <button
              onClick={onBack}
              disabled={!onBack}
              aria-label="Back"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-foreground/70 transition hover:bg-muted disabled:opacity-30"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <img src={jobbyistLogo} alt="Jobbyist" className="h-5 w-auto select-none dark:invert" />
            <div className="ml-auto flex-1 max-w-[60%]">
              <ProgressBar value={progress} />
            </div>
          </div>
        </header>
      )}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-32 pt-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <motion.button
      type={type}
      onClick={() => {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
        onClick?.();
      }}
      disabled={disabled}
      whileTap={{ scale: 0.97 }}
      className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-primary to-primary-glow px-6 py-4 text-base font-bold text-primary-foreground shadow-[0_10px_30px_-12px_color-mix(in_oklab,var(--color-primary)_60%,transparent)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </motion.button>
  );
}

function StickyCTA({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/85 px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 backdrop-blur-xl sm:px-6">
      <div className="mx-auto w-full max-w-2xl">{children}</div>
    </div>
  );
}

function OptionCard({
  active,
  onClick,
  children,
  icon,
  multi,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: string;
  multi?: boolean;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={[
        "group flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left text-[15px] font-semibold transition",
        active
          ? "border-primary bg-primary-soft text-foreground shadow-[0_8px_24px_-12px_color-mix(in_oklab,var(--color-primary)_55%,transparent)]"
          : "border-border bg-card text-foreground/85 hover:border-primary/40 hover:bg-muted/40",
      ].join(" ")}
    >
      {icon && <span aria-hidden className="text-xl">{icon}</span>}
      <span className="flex-1 min-w-0">{children}</span>
      <span
        className={[
          "grid h-6 w-6 shrink-0 place-items-center transition",
          multi ? "rounded-md border-2" : "rounded-full border-2",
          active ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent",
        ].join(" ")}
      >
        {active && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        )}
      </span>
    </motion.button>
  );
}

function QuestionHeader({ kicker, title, subtitle }: { kicker?: string; title: string; subtitle?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-6"
    >
      {kicker && (
        <div className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
          <span className="h-px w-6 bg-primary" />
          {kicker}
        </div>
      )}
      <h1 className="text-balance text-3xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      {subtitle && <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>}
    </motion.div>
  );
}

// ---------- Animated slide wrapper ----------
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
};

// ---------- Choice screen factory ----------
function SingleChoice({
  kicker,
  title,
  subtitle,
  options,
  value,
  onPick,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  options: { id: string; label: string; icon?: string }[];
  value?: string;
  onPick: (id: string) => void;
}) {
  return (
    <>
      <QuestionHeader kicker={kicker} title={title} subtitle={subtitle} />
      <div className="flex flex-col gap-3">
        {options.map((o, i) => (
          <motion.div
            key={o.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.05, duration: 0.3 }}
          >
            <OptionCard active={value === o.id} onClick={() => onPick(o.id)} icon={o.icon}>
              {o.label}
            </OptionCard>
          </motion.div>
        ))}
      </div>
    </>
  );
}

function MultiChoice({
  kicker,
  title,
  subtitle,
  options,
  values,
  onToggle,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  options: { id: string; label: string; icon?: string }[];
  values: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <>
      <QuestionHeader kicker={kicker} title={title} subtitle={subtitle} />
      <div className="flex flex-col gap-3">
        {options.map((o, i) => (
          <motion.div
            key={o.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.04, duration: 0.3 }}
          >
            <OptionCard active={values.includes(o.id)} onClick={() => onToggle(o.id)} icon={o.icon} multi>
              {o.label}
            </OptionCard>
          </motion.div>
        ))}
      </div>
    </>
  );
}

// ---------- Welcome ----------
function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="px-5 pt-5 sm:px-6">
        <img src="https://sprint.jobbist.co.za/jobbyistlogoblack.png" width="150px" height="auto" className="h-6 w-auto dark:invert" />
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-5 pb-32 pt-6 text-center sm:px-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
          className="relative mb-8"
        >
          <motion.div
            aria-hidden
            className="absolute -inset-12 rounded-full bg-gradient-to-tr from-primary/20 via-primary-glow/15 to-transparent blur-3xl"
            animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0.85, 0.6] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.img
            src="https://sprint.jobbyist.co.za/sprintbanner.png"
            alt="The 90-Day Job Search Sprint"
            className="relative mx-auto w-72 max-w-full"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary"
        >
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-primary" /></span>
          Now enrolling — South Africa
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-5 text-balance text-4xl font-black leading-[1.05] tracking-tight text-foreground sm:text-5xl"
        >
          Introducing the<br />90-Day Job Search Sprint
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground"
        >
          Transform your job search into a structured, measurable system designed specifically for South Africa's competitive employment market.
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 flex items-center gap-6 text-xs text-muted-foreground"
        >
          <div className="flex items-center gap-1.5"><span className="text-base">⚡</span> 90 days</div>
          <div className="flex items-center gap-1.5"><span className="text-base">🤖</span> AI-enhanced</div>
          <div className="flex items-center gap-1.5"><span className="text-base">🇿🇦</span> Built for SA</div>
        </motion.div>
      </main>
      <StickyCTA>
        <PrimaryButton onClick={onStart}>
          Start My Sprint
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
        </PrimaryButton>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">Takes ~2 minutes • No card required to start</p>
      </StickyCTA>
    </div>
  );
}

// ---------- AI Personalising ----------
function AIPersonalising({ answers, onDone }: { answers: Answers; onDone: (a: SprintAnalysis) => void }) {
  const messages = useMemo(
    () => [
      "Analysing your responses",
      "Consulting South African market data",
      "Tailoring your action plan",
      "Preparing recommendations",
    ],
    []
  );
  const [completed, setCompleted] = useState(0);
  const [analysis, setAnalysis] = useState<SprintAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const analyse = useServerFn(generateSprintAnalysis);

  // Step progress
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    messages.forEach((_, i) => {
      timers.push(setTimeout(() => setCompleted(i + 1), 900 * (i + 1)));
    });
    return () => timers.forEach(clearTimeout);
  }, [messages]);

  // Fetch Gemini analysis in parallel
  useEffect(() => {
    let cancelled = false;
    analyse({
      data: {
        profile: answers.profile,
        duration: answers.duration,
        appsPerWeek: answers.appsPerWeek,
        interviews: answers.interviews,
        challenges: answers.challenges,
        industries: answers.industries,
        location: answers.location,
        salary: answers.salary,
        commitment: answers.commitment,
        goals: answers.goals,
      },
    })
      .then((res) => { if (!cancelled) setAnalysis(res); })
      .catch((e) => { if (!cancelled) { console.error(e); setError("We couldn't reach the analyser — showing a default plan."); } });
    return () => { cancelled = true; };
  }, [analyse, answers]);

  const stepsDone = completed >= messages.length;
  const canReveal = stepsDone && (analysis || error);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      {!canReveal && (
        <>
          <div className="relative mb-8 grid h-32 w-32 place-items-center">
            <div className="absolute inset-0 rounded-full border-4 border-primary/15" />
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-primary-glow"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
              aria-hidden
            />
            <motion.div
              className="absolute inset-3 rounded-full border-2 border-transparent border-b-primary/60"
              animate={{ rotate: -360 }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
              aria-hidden
            />
            <div className="relative text-3xl" aria-hidden>🤖</div>
          </div>
          <h2 className="mb-2 text-2xl font-extrabold tracking-tight">Personalising your Sprint</h2>
          <p className="mb-8 text-sm text-muted-foreground" role="status" aria-live="polite">
            Our AI is analysing your goals and crafting your roadmap…
          </p>
          <ul className="w-full max-w-sm space-y-2.5">
            {messages.map((m, i) => {
              const done = completed > i;
              const active = completed === i;
              return (
                <li
                  key={m}
                  className={[
                    "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold",
                    done ? "border-success/40 bg-success/10 text-foreground" :
                    active ? "border-primary/40 bg-primary-soft text-foreground" :
                    "border-border text-muted-foreground",
                  ].join(" ")}
                >
                  <span className={[
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full",
                    done ? "bg-success text-white" :
                    active ? "bg-primary/15 text-primary" :
                    "bg-muted text-muted-foreground",
                  ].join(" ")}>
                    {done ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5"/></svg>
                    ) : active ? (
                      <motion.span className="block h-2 w-2 rounded-full bg-primary" animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 1, repeat: Infinity }} aria-hidden />
                    ) : null}
                  </span>
                  {m}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {canReveal && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg text-left"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
            <span aria-hidden>✨</span> Your personalised analysis
          </div>
          <h2 className="text-balance text-3xl font-black leading-tight tracking-tight sm:text-4xl">
            {analysis?.headline ?? "Your Sprint plan is ready"}
          </h2>

          <div className="mt-6 space-y-4">
            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Your strengths</h3>
              <ul className="mt-2 space-y-1.5">
                {(analysis?.strengths ?? []).map((s) => (
                  <li key={s} className="flex items-start gap-2 text-sm">
                    <span aria-hidden className="mt-0.5 text-success">✓</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Priority focus areas</h3>
              <ol className="mt-2 space-y-1.5">
                {(analysis?.focusAreas ?? []).map((s, i) => (
                  <li key={s} className="flex items-start gap-2 text-sm">
                    <span aria-hidden className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-black text-primary-foreground">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-2xl border border-primary/30 bg-primary-soft p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Your weekly target</h3>
              <p className="mt-1.5 text-sm font-semibold text-foreground">{analysis?.weeklyTarget}</p>
            </section>

            <p className="text-sm leading-relaxed text-muted-foreground">{analysis?.outlook}</p>
            {error && <p className="text-xs text-warning" role="alert">{error}</p>}
          </div>

          <StickyCTA><PrimaryButton onClick={() => analysis && onDone(analysis)}>See what you're up against</PrimaryButton></StickyCTA>
        </motion.div>
      )}
    </div>
  );
}

// ---------- Labour market reality ----------
function LabourMarket({ onNext }: { onNext: () => void }) {
  const stats = [
    { value: 32, suffix: "%", label: "South Africa's official unemployment rate — among the highest in the world.", icon: "📉" },
    { value: 60, suffix: "%", label: "Youth unemployment (15–34) sits dramatically above the national average.", icon: "👥" },
    { value: 250, suffix: "+", label: "Average applications per vacancy at mid-level South African roles.", icon: "📨" },
    { value: 7, suffix: "s", label: "Average time a recruiter spends scanning a CV before deciding.", icon: "⏱️" },
    { value: 3, suffix: "×", label: "Structured job-seekers consistently outperform random applicants.", icon: "🎯" },
  ];
  return (
    <>
      <QuestionHeader
        kicker="The reality"
        title="South Africa's job market is brutal. Strategy wins."
        subtitle="Here's what you're actually competing against — and why a structured system changes everything."
      />
      <div className="grid gap-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: i * 0.08, duration: 0.45 }}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-2xl">
                {s.icon}
              </div>
              <div className="min-w-0">
                <div className="text-3xl font-black tracking-tight text-primary">
                  <Counter to={s.value} suffix={s.suffix} />
                </div>
                <p className="mt-1 text-sm leading-snug text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <StickyCTA><PrimaryButton onClick={onNext}>Show me the methodology</PrimaryButton></StickyCTA>
    </>
  );
}

// ---------- Methodology timeline ----------
function Methodology({ onNext }: { onNext: () => void }) {
  const phases = [
    { id: 1, days: "Days 1–7", title: "Foundation", icon: "🧰", desc: "Deep profile audit, role targeting and AI-powered digital toolkit setup." },
    { id: 2, days: "Days 8–21", title: "Market Targeting", icon: "🎯", desc: "Define target industries, benchmark salaries and start upskilling modules." },
    { id: 3, days: "Days 22–60", title: "Application Sprint", icon: "🚀", desc: "High-volume daily applications, expert-reviewed CVs and recruiter outreach." },
    { id: 4, days: "Days 45–75", title: "Visibility Boost", icon: "📣", desc: "LinkedIn optimisation, personal brand and recruiter visibility campaigns." },
    { id: 5, days: "Days 60–85", title: "Interview Readiness", icon: "🎤", desc: "Mock interviews, confidence building and practical-task practice." },
    { id: 6, days: "Days 85–90", title: "Placement & Final Push", icon: "🏆", desc: "Performance review, strategy refinement and offer-negotiation guidance." },
  ];
  return (
    <>
      <QuestionHeader
        kicker="The methodology"
        title="Six phases. 90 days. One outcome."
        subtitle="Every day has a purpose. Every phase builds on the last."
      />
      <div className="relative">
        <div className="absolute left-[27px] top-2 bottom-2 w-[2px] bg-gradient-to-b from-primary via-primary/40 to-transparent" />
        <ul className="space-y-4">
          {phases.map((p, i) => (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.08, duration: 0.45 }}
              className="relative flex gap-4"
            >
              <div className="relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-2xl text-primary-foreground shadow-lg">
                {p.icon}
              </div>
              <div className="min-w-0 flex-1 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-primary">{p.days}</div>
                <h3 className="mt-0.5 text-base font-extrabold tracking-tight">Phase {p.id}: {p.title}</h3>
                <p className="mt-1 text-sm leading-snug text-muted-foreground">{p.desc}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
      <StickyCTA><PrimaryButton onClick={onNext}>Continue</PrimaryButton></StickyCTA>
    </>
  );
}

// ---------- Motivation ----------
function Motivation({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 14 }}
        className="mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-primary to-primary-glow text-4xl text-primary-foreground shadow-2xl"
      >
        💪
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="text-balance text-4xl font-black leading-tight tracking-tight sm:text-5xl"
      >
        You're closer than you think.
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground"
      >
        Most job seekers fail because they lack <span className="font-bold text-foreground">structure</span> — not ability.
        The 90-Day Job Search Sprint helps you build consistent daily habits, improve every application, stay accountable, and maximise every opportunity.
      </motion.p>
      <StickyCTA><PrimaryButton onClick={onNext}>I'm ready</PrimaryButton></StickyCTA>
    </div>
  );
}

// ---------- Offer ----------
function Offer({ onNext }: { onNext: () => void }) {
  const fireConfetti = () => {
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.3 }, colors: ["#2563eb", "#60a5fa", "#fbbf24", "#f87171"] });
  };
  useEffect(() => {
    const t = setTimeout(fireConfetti, 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <>
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-[#0b1430] via-[#0f1d4a] to-[#08102a] p-6 text-white shadow-2xl">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary-glow/30 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.div
          initial={{ rotate: -8, scale: 0.7, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 140, damping: 14 }}
          className="absolute -right-3 top-4 grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 text-center font-black leading-none text-white shadow-xl"
        >
          <div>
            <div className="text-2xl">50%</div>
            <div className="text-[10px] tracking-wider">OFF</div>
          </div>
        </motion.div>
        <div className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary-glow">
          <span className="h-px w-6 bg-primary-glow" /> Limited-time offer
        </div>
        <h2 className="text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl">
          50% OFF Jobbyist Pro.<br />Sprint access included.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          Subscribe to Jobbyist Pro and get your first 3 months at half price — with full access to The 90-Day Job Search Sprint built in, at no extra cost.
        </p>
        <ul className="mt-5 space-y-2.5">
          {[
            "50% off your first 3 months of Jobbyist Pro",
            "Free access to the full 90-Day Job Search Sprint programme",
            "Your unique discount code, delivered to your inbox instantly",
            "Restricted to the first 100 redemptions, full stop",
          ].map((t, i) => (
            <motion.li
              key={t}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.08 }}
              className="flex items-start gap-3 text-sm"
            >
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-white">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              </span>
              <span className="text-white/90">{t}</span>
            </motion.li>
          ))}
        </ul>

        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="mt-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
        >
          <motion.span
            className="inline-flex items-center rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white shadow-lg"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          >
            100 spots
          </motion.span>
          <span className="text-xs text-white/70">Limited to the first 100 redemptions</span>
        </motion.div>

        <motion.img
          src={sprintIllustration}
          alt=""
          aria-hidden
          className="pointer-events-none mt-4 w-40 opacity-90"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <StickyCTA>
        <PrimaryButton onClick={onNext}>Claim 50% OFF</PrimaryButton>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">No deceptive timers. Real cap of 100 redemptions.</p>
      </StickyCTA>
    </>
  );
}

// ---------- Social proof ----------
function SocialProof({ onNext }: { onNext: () => void }) {
  const testimonials = [
    { name: "Lerato M.", role: "Marketing Specialist · Johannesburg", quote: "Four interviews in week six. The structure forced me to apply consistently — not when I felt like it.", avatar: "🌟" },
    { name: "Sipho N.", role: "Operations · Cape Town", quote: "My CV was invisible. After the audit, recruiters started replying within days.", avatar: "💼" },
    { name: "Kayla R.", role: "Customer Success · Durban", quote: "I was retrenched. Day 47 of the Sprint I signed an offer above my previous salary.", avatar: "🚀" },
  ];
  return (
    <>
      <QuestionHeader kicker="Real outcomes" title="Sprinters across South Africa are landing offers." />
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { v: 73, s: "%", l: "Higher hire rate" },
          { v: 4, s: "", l: "Avg. interviews in 60 days" },
          { v: 4.9, s: "", l: "Avg. rating" },
        ].map((m) => (
          <div key={m.l} className="rounded-2xl border border-border bg-card p-3 text-center shadow-sm">
            <div className="text-2xl font-black tracking-tight text-primary">
              {m.v === 4.9 ? "4.9" : <Counter to={m.v} suffix={m.s} />}
            </div>
            <div className="mt-1 text-[10.5px] font-semibold leading-tight text-muted-foreground">{m.l}</div>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {testimonials.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center gap-1 text-amber-400">
              {Array.from({ length: 5 }).map((_, k) => <span key={k}>★</span>)}
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">"{t.quote}"</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-lg">{t.avatar}</span>
              <div className="min-w-0">
                <div className="text-sm font-bold">{t.name}</div>
                <div className="truncate text-xs text-muted-foreground">{t.role}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="mt-6">
        <div className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sprinters have been hired at</div>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-bold text-foreground/40">
          {["Discovery", "Standard Bank", "Takealot", "MTN", "Capitec", "Investec", "Naspers"].map((b) => (
            <span key={b} className="tracking-tight">{b}</span>
          ))}
        </div>
      </div>
      <StickyCTA><PrimaryButton onClick={onNext}>Create my account</PrimaryButton></StickyCTA>
    </>
  );
}

// ---------- Account ----------
function Account({
  answers,
  setAnswers,
  onNext,
}: {
  answers: Answers;
  setAnswers: (a: Answers) => void;
  onNext: () => void;
}) {
  const [touched, setTouched] = useState(false);
  const valid =
    !!answers.firstName && !!answers.lastName && /\S+@\S+\.\S+/.test(answers.email ?? "") && (answers.password?.length ?? 0) >= 8;

  return (
    <>
      <QuestionHeader kicker="Almost there" title="Create your account" subtitle="Save your progress and unlock your personalised plan." />
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3 py-3 text-sm font-bold hover:bg-muted/50">
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.12-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.83Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.3 9.14 5.38 12 5.38Z"/></svg>
          Google
        </button>
        <button className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3 py-3 text-sm font-bold hover:bg-muted/50">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.7c0-2.6 2.1-3.8 2.2-3.9-1.2-1.7-3-2-3.7-2-1.6-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.1 2.5-1.8 3-.5 7.5 1.2 9.9.8 1.2 1.8 2.6 3.1 2.5 1.2-.1 1.7-.8 3.2-.8 1.4 0 1.9.8 3.3.8 1.4 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.4-1-2.4-3.8ZM14 4.9c.6-.8 1.1-2 1-3.1-1 0-2.1.6-2.7 1.4-.6.7-1.2 1.9-1 3 1.1.1 2.2-.5 2.7-1.3Z"/></svg>
          Apple
        </button>
      </div>
      <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        OR
        <div className="h-px flex-1 bg-border" />
      </div>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (valid) onNext();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField label="First name" required>
            <input
              className="w-full rounded-xl border border-border bg-background px-3 py-3 text-[15px] outline-none focus:border-primary"
              value={answers.firstName ?? ""}
              onChange={(e) => setAnswers({ ...answers, firstName: e.target.value })}
              autoComplete="given-name"
            />
          </FormField>
          <FormField label="Last name" required>
            <input
              className="w-full rounded-xl border border-border bg-background px-3 py-3 text-[15px] outline-none focus:border-primary"
              value={answers.lastName ?? ""}
              onChange={(e) => setAnswers({ ...answers, lastName: e.target.value })}
              autoComplete="family-name"
            />
          </FormField>
        </div>
        <FormField label="Email" required error={touched && !!answers.email && !/\S+@\S+\.\S+/.test(answers.email) ? "Enter a valid email" : undefined}>
          <input
            type="email"
            className="w-full rounded-xl border border-border bg-background px-3 py-3 text-[15px] outline-none focus:border-primary"
            value={answers.email ?? ""}
            onChange={(e) => setAnswers({ ...answers, email: e.target.value })}
            autoComplete="email"
          />
        </FormField>
        <FormField label="Password" required hint="Minimum 8 characters">
          <input
            type="password"
            className="w-full rounded-xl border border-border bg-background px-3 py-3 text-[15px] outline-none focus:border-primary"
            value={answers.password ?? ""}
            onChange={(e) => setAnswers({ ...answers, password: e.target.value })}
            autoComplete="new-password"
          />
        </FormField>
        <StickyCTA><PrimaryButton type="submit" disabled={!valid}>Continue to checkout</PrimaryButton></StickyCTA>
      </form>
    </>
  );
}

function FormField({ label, children, required, hint, error }: { label: string; children: React.ReactNode; required?: boolean; hint?: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}{required && <span className="text-destructive"> *</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-destructive">{error}</span> :
       hint ? <span className="mt-1 block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

// ---------- Payment ----------
function Payment({ onPay }: { onPay: () => void }) {
  return (
    <>
      <QuestionHeader kicker="Checkout" title="Unlock your Sprint" subtitle="Cancel anytime. 14-day money-back guarantee." />
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-primary">Jobbyist Pro</div>
            <div className="mt-0.5 text-lg font-extrabold tracking-tight">3-Month Sprint Bundle</div>
          </div>
          <span className="rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">50% OFF</span>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <Row label="Jobbyist Pro (3 months)" value={<><span className="text-muted-foreground line-through mr-2">R897</span><span className="font-bold">R448.50</span></>} />
          <Row label="90-Day Sprint programme" value={<span className="font-bold text-success">Included free</span>} />
          <Row label="Sprint Service Handbook" value={<span className="font-bold text-success">Included</span>} />
          <div className="my-2 h-px bg-border" />
          <Row label="You save" value={<span className="font-bold text-success">R448.50</span>} />
          <Row label={<span className="text-base font-extrabold text-foreground">Total today</span>} value={<span className="text-base font-black tracking-tight">R448.50</span>} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-bold text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1">🔒 256-bit SSL</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1">💳 Visa · Mastercard</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1">↩️ 14-day refund</span>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-[12px] leading-relaxed text-muted-foreground">
        <p>
          <strong className="text-foreground">Jobbyist is not a recruitment agency</strong> and does not place candidates or guarantee employment outcomes. Outcomes depend on market conditions, employer decisions, and your own engagement.
        </p>
        <p className="mt-2">
          <a href="https://sprint.jobbyist.co.za/sprint.pdf" target="_blank" rel="noreferrer" className="font-bold text-primary underline underline-offset-2">
            Read the Service Handbook (PDF)
          </a>
        </p>
      </div>

      <StickyCTA>
        <PrimaryButton onClick={onPay}>Unlock My Sprint — R448.50</PrimaryButton>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">Secure checkout · Cancel anytime</p>
      </StickyCTA>
    </>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ---------- Success ----------
function Success({ name }: { name?: string }) {
  useEffect(() => {
    const burst = () => {
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.35 }, colors: ["#2563eb", "#60a5fa", "#fbbf24", "#10b981", "#f87171"] });
    };
    burst();
    const t1 = setTimeout(burst, 600);
    const t2 = setTimeout(burst, 1300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center text-center">
      <motion.div
        initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 160, damping: 12 }}
        className="mb-6 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-success to-primary text-5xl text-white shadow-2xl"
      >
        🎉
      </motion.div>
      <h1 className="text-balance text-4xl font-black leading-tight tracking-tight sm:text-5xl">You're officially in{ name ? `, ${name}!` : "!" }</h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
        Your personalised 90-Day Job Search Sprint has been created. You'll receive your discount code by email and can begin transforming your job search immediately.
      </p>
      <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
        <PrimaryButton onClick={() => { /* mock dashboard */ }}>Start My Sprint</PrimaryButton>
        <button className="rounded-full border border-border bg-card py-3.5 text-sm font-bold hover:bg-muted/50">Go to Dashboard</button>
      </div>
      <img src={sprintLogo} alt="The 90-Day Job Search Sprint" className="mt-12 h-12 w-auto opacity-80 dark:invert" />
    </div>
  );
}

// ---------- Main controller ----------
export function Onboarding() {
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const hydrated = useRef(false);

  // hydrate
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.answers) setAnswers({ ...DEFAULT_ANSWERS, ...parsed.answers });
        if (typeof parsed.index === "number" && parsed.index < STEPS.length - 1) setIndex(parsed.index);
      }
    } catch {/* ignore */}
    hydrated.current = true;
  }, []);

  // persist
  useEffect(() => {
    if (!hydrated.current) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, index })); } catch {/* ignore */}
  }, [answers, index]);

  const stepId = STEPS[index];
  const progress = Math.round(((index + 1) / STEPS.length) * 100);

  const next = () => { setDir(1); setIndex((i) => Math.min(i + 1, STEPS.length - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const back = index > 0 ? () => { setDir(-1); setIndex((i) => Math.max(i - 1, 0)); window.scrollTo({ top: 0, behavior: "smooth" }); } : undefined;

  const toggle = (key: "challenges" | "industries" | "goals", id: string) => {
    setAnswers((a) => {
      const set = new Set(a[key]); set.has(id) ? set.delete(id) : set.add(id);
      return { ...a, [key]: [...set] };
    });
  };

  const auto = (key: keyof Answers, id: string) => {
    setAnswers((a) => ({ ...a, [key]: id } as Answers));
    setTimeout(next, 220);
  };

  if (stepId === "welcome") return <Welcome onStart={next} />;
  if (stepId === "success") {
    return (
      <StepShell progress={100} onBack={undefined} showHeader={false}>
        <Success name={answers.firstName} />
      </StepShell>
    );
  }

  return (
    <StepShell onBack={back} progress={progress}>
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div
          key={stepId}
          custom={dir}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="flex flex-1 flex-col"
        >
          {stepId === "q-profile" && (
            <SingleChoice
              kicker={`Question 1 of 10`}
              title="What best describes you?"
              value={answers.profile}
              onPick={(id) => auto("profile", id)}
              options={[
                { id: "graduate", label: "Graduate looking for first job", icon: "🎓" },
                { id: "unemployed", label: "Unemployed professional", icon: "🔎" },
                { id: "changer", label: "Career changer", icon: "🔄" },
                { id: "freelancer", label: "Freelancer looking for stable work", icon: "💻" },
                { id: "retrenched", label: "Retrenched employee", icon: "📉" },
                { id: "employed", label: "Currently employed but looking", icon: "💼" },
              ]}
            />
          )}
          {stepId === "q-duration" && (
            <SingleChoice
              kicker="Question 2 of 10"
              title="How long have you been actively searching?"
              value={answers.duration}
              onPick={(id) => auto("duration", id)}
              options={[
                { id: "<1m", label: "Less than 1 month" },
                { id: "1-3m", label: "1–3 months" },
                { id: "3-6m", label: "3–6 months" },
                { id: "6-12m", label: "6–12 months" },
                { id: ">1y", label: "More than 1 year" },
              ]}
            />
          )}
          {stepId === "q-apps" && (
            <SingleChoice
              kicker="Question 3 of 10"
              title="How many jobs do you apply for every week?"
              value={answers.appsPerWeek}
              onPick={(id) => auto("appsPerWeek", id)}
              options={[
                { id: "1-5", label: "1–5" },
                { id: "6-10", label: "6–10" },
                { id: "11-20", label: "11–20" },
                { id: "20+", label: "20+" },
              ]}
            />
          )}
          {stepId === "q-interviews" && (
            <SingleChoice
              kicker="Question 4 of 10"
              title="How many interviews have you secured recently?"
              value={answers.interviews}
              onPick={(id) => auto("interviews", id)}
              options={[
                { id: "none", label: "None" },
                { id: "1-2", label: "1–2" },
                { id: "3-5", label: "3–5" },
                { id: ">5", label: "More than 5" },
              ]}
            />
          )}
          {stepId === "q-challenges" && (
            <>
              <MultiChoice
                kicker="Question 5 of 10"
                title="What's your biggest challenge?"
                subtitle="Select all that apply."
                values={answers.challenges}
                onToggle={(id) => toggle("challenges", id)}
                options={[
                  { id: "opps", label: "Finding opportunities", icon: "🔎" },
                  { id: "cv", label: "CV isn't getting noticed", icon: "📄" },
                  { id: "confidence", label: "Interview confidence", icon: "💬" },
                  { id: "network", label: "Networking", icon: "🤝" },
                  { id: "motivation", label: "Lack of motivation", icon: "🔋" },
                  { id: "strategy", label: "No clear strategy", icon: "🧭" },
                  { id: "ats", label: "ATS rejections", icon: "🤖" },
                  { id: "salary", label: "Salary negotiation", icon: "💰" },
                ]}
              />
              <StickyCTA><PrimaryButton onClick={next} disabled={answers.challenges.length === 0}>Continue</PrimaryButton></StickyCTA>
            </>
          )}
          {stepId === "q-industries" && (
            <>
              <MultiChoice
                kicker="Question 6 of 10"
                title="Which industries interest you?"
                subtitle="Select all that apply."
                values={answers.industries}
                onToggle={(id) => toggle("industries", id)}
                options={[
                  { id: "tech", label: "Tech & Software", icon: "💻" },
                  { id: "finance", label: "Finance & Banking", icon: "🏦" },
                  { id: "marketing", label: "Marketing & Comms", icon: "📣" },
                  { id: "retail", label: "Retail & E-commerce", icon: "🛍️" },
                  { id: "health", label: "Healthcare", icon: "🩺" },
                  { id: "education", label: "Education & Training", icon: "📚" },
                  { id: "legal", label: "Legal & Compliance", icon: "⚖️" },
                  { id: "creative", label: "Creative & Design", icon: "🎨" },
                  { id: "ops", label: "Operations & Admin", icon: "🗂️" },
                  { id: "mining", label: "Mining & Energy", icon: "⛏️" },
                ]}
              />
              <StickyCTA><PrimaryButton onClick={next} disabled={answers.industries.length === 0}>Continue</PrimaryButton></StickyCTA>
            </>
          )}
          {stepId === "q-location" && (
            <SingleChoice
              kicker="Question 7 of 10"
              title="Preferred employment location"
              value={answers.location}
              onPick={(id) => auto("location", id)}
              options={[
                { id: "remote", label: "Remote", icon: "🏡" },
                { id: "hybrid", label: "Hybrid", icon: "🔁" },
                { id: "onsite", label: "On-site", icon: "🏢" },
                { id: "none", label: "No preference", icon: "🌍" },
              ]}
            />
          )}
          {stepId === "q-salary" && (
            <>
              <QuestionHeader
                kicker="Question 8 of 10"
                title="What's your salary expectation?"
                subtitle="Monthly gross salary in ZAR."
              />
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="text-center">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Target monthly</div>
                  <div className="mt-1 text-5xl font-black tracking-tight text-primary">
                    R{answers.salary.toLocaleString()}
                  </div>
                </div>
                <input
                  type="range" min={5000} max={150000} step={1000}
                  value={answers.salary}
                  onChange={(e) => setAnswers({ ...answers, salary: Number(e.target.value) })}
                  className="mt-6 w-full accent-[var(--color-primary)]"
                />
                <div className="mt-2 flex justify-between text-[11px] font-semibold text-muted-foreground">
                  <span>R5,000</span><span>R150,000+</span>
                </div>
              </div>
              <StickyCTA><PrimaryButton onClick={next}>Continue</PrimaryButton></StickyCTA>
            </>
          )}
          {stepId === "q-commitment" && (
            <>
              <QuestionHeader
                kicker="Question 9 of 10"
                title="How committed are you to finding employment in the next 90 days?"
                subtitle="Be honest. We'll match your plan intensity."
              />
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="text-center text-7xl font-black tracking-tight text-primary">
                  {answers.commitment}<span className="text-2xl text-muted-foreground">/10</span>
                </div>
                <input
                  type="range" min={1} max={10}
                  value={answers.commitment}
                  onChange={(e) => setAnswers({ ...answers, commitment: Number(e.target.value) })}
                  className="mt-6 w-full accent-[var(--color-primary)]"
                />
                <div className="mt-2 flex justify-between text-[11px] font-semibold text-muted-foreground">
                  <span>Casual</span><span>All in</span>
                </div>
              </div>
              <StickyCTA><PrimaryButton onClick={next}>Continue</PrimaryButton></StickyCTA>
            </>
          )}
          {stepId === "q-goals" && (
            <>
              <MultiChoice
                kicker="Question 10 of 10"
                title="What are your 90-day goals?"
                subtitle="Pick the wins that matter most."
                values={answers.goals}
                onToggle={(id) => toggle("goals", id)}
                options={[
                  { id: "interviews", label: "Secure interviews", icon: "🎤" },
                  { id: "cv", label: "Improve my CV", icon: "📄" },
                  { id: "linkedin", label: "Build my LinkedIn profile", icon: "🔗" },
                  { id: "network", label: "Learn networking", icon: "🤝" },
                  { id: "accountable", label: "Stay accountable", icon: "📅" },
                  { id: "land", label: "Land a new job", icon: "🏆" },
                ]}
              />
              <StickyCTA><PrimaryButton onClick={next} disabled={answers.goals.length === 0}>Build my Sprint</PrimaryButton></StickyCTA>
            </>
          )}
          {stepId === "ai-personalising" && <AIPersonalising onDone={next} />}
          {stepId === "labour-market" && <LabourMarket onNext={next} />}
          {stepId === "methodology" && <Methodology onNext={next} />}
          {stepId === "motivation" && <Motivation onNext={next} />}
          {stepId === "offer" && <Offer onNext={next} />}
          {stepId === "social-proof" && <SocialProof onNext={next} />}
          {stepId === "account" && <Account answers={answers} setAnswers={setAnswers} onNext={next} />}
          {stepId === "payment" && <Payment onPay={next} />}
        </motion.div>
      </AnimatePresence>
      {/* Footer brand mark */}
      <div className="mt-10 flex flex-col items-center gap-3 opacity-70">
        <img src="https://sprint.jobbist.co.za/sprintlogo.png" width="150px" height="auto" alt="The 90-Day Job Search Sprint" className="h-8 w-auto dark:invert" />
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Jobbyist South Africa · All rights reserved</p>
      </div>
    </StepShell>
  );
}
