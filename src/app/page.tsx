import Link from "next/link";
import {
  ArrowRight,
  Zap,
  Sparkles,
  Wand2,
  Layers,
  Gauge,
  RotateCw,
  Upload,
  CheckCircle2,
  Eye,
} from "lucide-react";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#reliability", label: "Reliability" },
];

const SOURCE_SYSTEMS = [
  "HubSpot",
  "Salesforce",
  "Zoho CRM",
  "Facebook Lead Ads",
  "Google Ads",
  "Excel",
  "Google Sheets",
];

const FEATURES = [
  {
    tag: "AI SMART MAPPING",
    icon: Wand2,
    title: "Zero manual mapping",
    description:
      "The model infers meaning from column content, not header text. Phone, Mobile, WhatsApp, Contact Number — all resolve the same way, with no template to configure per source.",
    visual: (
      <div className="mt-5 rounded-[var(--radius-md)] border border-border bg-surface-raised p-3 space-y-1.5">
        {[
          ["Full Name", "name"],
          ["Phone No.", "mobile_without_country_code"],
          ["Client", "name"],
        ].map(([from, to]) => (
          <div key={from} className="flex items-center gap-2 text-[10.5px] font-mono">
            <span className="flex-1 truncate text-muted-2">{from}</span>
            <ArrowRight className="size-3 text-accent shrink-0" />
            <span className="flex-1 truncate text-foreground">{to}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    tag: "BATCH PROCESSING",
    icon: Layers,
    title: "Bounded, resilient batching",
    description:
      "Rows are split into 25-row batches and mapped with 4 batches in flight at once — large CSVs degrade gracefully instead of firing hundreds of simultaneous requests.",
    visual: (
      <div className="mt-5 rounded-[var(--radius-md)] border border-border bg-surface-raised p-3">
        <div className="flex items-center justify-between text-[10.5px] text-muted mb-2">
          <span>batch 3/4</span>
          <span className="font-mono tabular text-foreground">75%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface overflow-hidden">
          <div className="h-full w-3/4 rounded-full bg-accent" />
        </div>
      </div>
    ),
  },
  {
    tag: "PER-ROW SCORING",
    icon: Gauge,
    title: "Confidence you can act on",
    description:
      "Every mapped row gets a 0–1 confidence score, not a binary pass/fail — so you know exactly which imported records are worth a second glance before they hit your CRM.",
    visual: (
      <div className="mt-5 flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface-raised p-3">
        <div className="relative size-11 shrink-0">
          <svg className="size-11 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="var(--success)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 15}
              strokeDashoffset={2 * Math.PI * 15 * 0.03}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono tabular text-foreground">
            97%
          </span>
        </div>
        <p className="text-[10.5px] text-muted leading-snug">
          High-confidence rows import silently. Low-confidence ones get flagged for review.
        </p>
      </div>
    ),
  },
  {
    tag: "ERROR HANDLING",
    icon: RotateCw,
    title: "Retry & fix, never lose data",
    description:
      "Rows lost to a transient AI failure are retryable with one click. Rows the AI genuinely can't map surface with an explicit reason — and can be corrected inline instead of vanishing.",
    visual: (
      <div className="mt-5 flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-raised p-3">
        <span className="rounded-full border border-danger/30 bg-danger-muted px-2 py-0.5 text-[10.5px] text-danger font-medium">
          3 failed rows
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent-muted px-2 py-0.5 text-[10.5px] text-accent font-medium">
          <RotateCw className="size-2.5" />
          Retry failed
        </span>
      </div>
    ),
  },
];

const RELIABILITY_STATS = [
  { value: "25 rows", label: "per AI batch — small enough that one bad response can't invalidate a whole import" },
  { value: "4x", label: "batches processed concurrently, bounded so large files degrade gracefully" },
  { value: "3", label: "automatic retries per batch with exponential backoff before a row is ever marked failed" },
  { value: "0", label: "rows silently dropped — every row is reconciled against what was sent" },
];

const STEPS = [
  { icon: Upload, title: "Upload CSV", description: "Drop your file. Parsed instantly in the browser." },
  { icon: Sparkles, title: "AI understands", description: "Column meaning inferred from content, not headers." },
  { icon: Layers, title: "Normalize data", description: "Business rules for multi-email, multi-phone, enums applied." },
  { icon: Eye, title: "Review & fix", description: "Confidence scores, retry failed rows, correct skips inline." },
  { icon: CheckCircle2, title: "Import leads", description: "Clean, schema-correct records — export CSV or JSON." },
];

export default function LandingPage() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-[6px] bg-accent">
              <Zap className="size-3.5 text-white" fill="white" strokeWidth={0} />
            </div>
            <span className="text-[13px] font-semibold tracking-tight">ImportCSV Pro</span>
          </div>

          <nav className="hidden sm:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[13px] text-muted hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <Link
            href="/import"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-accent hover:bg-accent-hover text-white text-[13px] font-medium px-3.5 h-8 transition-colors"
          >
            Open importer
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[11.5px] text-muted mb-6">
              <Sparkles className="size-3 text-accent" />
              AI-powered CSV mapping
            </div>

            <h1 className="text-[36px] sm:text-[44px] leading-[1.1] font-semibold tracking-tight text-foreground">
              Stop mapping columns.
              <br />
              Import <span className="text-accent">any CRM export</span> in minutes.
            </h1>

            <p className="mt-5 text-[14.5px] text-muted max-w-md leading-relaxed">
              Upload a CSV from any system — ImportCSV Pro infers what every column means and maps it straight into your CRM schema. No template, no per-source setup, no manual mapping screen.
            </p>

            <div className="mt-8 flex items-center gap-3">
              <Link
                href="/import"
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-accent hover:bg-accent-hover text-white text-[13.5px] font-medium px-5 h-11 transition-colors shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset]"
              >
                Import a CSV
                <ArrowRight className="size-4" />
              </Link>
              <a
                href="/api/sample-csv"
                download
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border hover:border-border-hover text-foreground text-[13.5px] font-medium px-5 h-11 transition-colors"
              >
                Download sample CSV
              </a>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px] text-muted">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-success" />
                No config required
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-success" />
                Stateless — nothing stored server-side
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-success" />
                Sanitized exports
              </span>
            </div>
          </div>

          {/* Product mockup card */}
          <div className="relative">
            <div className="absolute -inset-8 bg-accent/10 blur-3xl rounded-full" aria-hidden />
            <div className="relative rounded-[var(--radius-lg)] border border-border bg-surface shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-5 items-center justify-center rounded-[5px] bg-accent">
                    <Zap className="size-3 text-white" fill="white" strokeWidth={0} />
                  </div>
                  <span className="text-[12.5px] font-medium text-foreground">Import Leads</span>
                </div>
                <span className="text-[10.5px] text-muted-2 font-mono">leads_messy_data.csv</span>
              </div>

              <div className="p-4 space-y-3">
                {[
                  { label: "Uploading file…", state: "done" },
                  { label: "Parsing CSV…", state: "done" },
                  { label: "AI mapping columns…", state: "done", badge: "96% confidence" },
                  { label: "Applying business rules…", state: "active" },
                  { label: "Finalizing…", state: "pending" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-[12px]">
                    <span
                      className={
                        row.state === "pending" ? "text-muted-2" : "text-foreground"
                      }
                    >
                      {row.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {row.badge && (
                        <span className="rounded-full border border-accent/30 bg-accent-muted px-2 py-0.5 text-[10px] text-accent font-medium">
                          {row.badge}
                        </span>
                      )}
                      {row.state === "done" && <CheckCircle2 className="size-3.5 text-success" />}
                      {row.state === "active" && (
                        <span className="size-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                      )}
                      {row.state === "pending" && (
                        <span className="size-3.5 rounded-full border border-border" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
                <div className="px-4 py-3 text-center">
                  <p className="text-[16px] font-semibold tabular text-foreground">1,532</p>
                  <p className="text-[10px] text-muted mt-0.5">Imported</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-[16px] font-semibold tabular text-success">96.4%</p>
                  <p className="text-[10px] text-muted mt-0.5">Avg. confidence</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-[16px] font-semibold tabular text-warning">2</p>
                  <p className="text-[10px] text-muted mt-0.5">Skipped</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Source systems strip */}
        <section className="border-y border-border bg-surface/40">
          <div className="mx-auto max-w-6xl px-6 py-8">
            <p className="text-center text-[11px] font-medium text-muted-2 tracking-wide uppercase mb-4">
              Works with exports from
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
              {SOURCE_SYSTEMS.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-border px-3 py-1 text-[12px] text-muted font-mono"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-[13px] font-medium text-accent tracking-wide uppercase">Features</h2>
            <p className="mt-2 text-[26px] font-semibold tracking-tight text-foreground">
              Built for CSVs that were never designed to be imported
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-[var(--radius-lg)] border border-border bg-surface p-5">
                <span className="inline-block rounded-full border border-accent/30 bg-accent-muted px-2 py-0.5 text-[10px] font-medium text-accent tracking-wide mb-3">
                  {f.tag}
                </span>
                <div className="flex size-9 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface-raised mb-3">
                  <f.icon className="size-4 text-accent" strokeWidth={1.75} />
                </div>
                <h3 className="text-[14px] font-medium text-foreground">{f.title}</h3>
                <p className="mt-1.5 text-[12.5px] text-muted leading-relaxed">{f.description}</p>
                {f.visual}
              </div>
            ))}
          </div>
        </section>

        {/* Reliability stats */}
        <section id="reliability" className="border-y border-border bg-[#0d0d11]">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <p className="text-[11px] font-medium text-accent tracking-wide uppercase mb-8 text-center">
              Built assuming the AI will sometimes be wrong
            </p>
            <div className="grid sm:grid-cols-4 gap-6">
              {RELIABILITY_STATS.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-[28px] font-semibold tabular text-foreground">{stat.value}</p>
                  <p className="mt-1.5 text-[11.5px] text-muted leading-snug max-w-[180px] mx-auto">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center mb-14">
            <h2 className="text-[13px] font-medium text-accent tracking-wide uppercase">How it works</h2>
            <p className="mt-2 text-[26px] font-semibold tracking-tight text-foreground">
              Five steps. No configuration screen.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-6 sm:gap-2">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex sm:flex-col items-start sm:items-center gap-4 sm:gap-3 flex-1 text-left sm:text-center">
                <div className="flex flex-col items-center shrink-0">
                  <div className="flex size-11 items-center justify-center rounded-full border border-border bg-surface-raised">
                    <step.icon className="size-4.5 text-accent" strokeWidth={1.75} />
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="hidden sm:block w-full h-px bg-border mt-5 -mb-5 translate-y-[-22px]" aria-hidden />
                  )}
                </div>
                <div>
                  <p className="text-[12.5px] font-medium text-foreground">
                    {i + 1}. {step.title}
                  </p>
                  <p className="text-[11.5px] text-muted mt-0.5 max-w-[140px]">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <div className="rounded-[var(--radius-lg)] border border-accent/20 bg-accent-muted/40 px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="flex size-11 items-center justify-center rounded-[var(--radius-md)] bg-accent shrink-0">
                  <Sparkles className="size-5 text-white" />
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-foreground">Ready to import smarter?</p>
                  <p className="text-[12.5px] text-muted mt-0.5">
                    Try it with your own CSV, or grab the sample file to see it in action.
                  </p>
                </div>
              </div>
              <Link
                href="/import"
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-accent hover:bg-accent-hover text-white text-[13.5px] font-medium px-5 h-11 transition-colors shrink-0"
              >
                Open the importer
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-10 grid sm:grid-cols-2 gap-6">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-[6px] bg-accent">
              <Zap className="size-3.5 text-white" fill="white" strokeWidth={0} />
            </div>
            <span className="text-[13px] text-muted">ImportCSV Pro — AI mapping, sanitized exports, retryable by design.</span>
          </div>
          <div className="flex sm:justify-end items-center gap-4 text-[12.5px]">
            <a href="https://github.com/Thippeswamykr1204" className="text-muted hover:text-foreground transition-colors">
              GitHub
            </a>
            <a href="https://www.linkedin.com/in/thippeswamy-kr" className="text-muted hover:text-foreground transition-colors">
              LinkedIn
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}