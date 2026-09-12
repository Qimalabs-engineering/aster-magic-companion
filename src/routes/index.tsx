import { createFileRoute } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "pikopod — Catch third-party API drift" },
      { name: "description", content: "Watch published API specs and real responses for breaking provider changes with one local Go binary." },
      { property: "og:title", content: "pikopod — Catch third-party API drift" },
      { property: "og:description", content: "Watch published API specs and real responses for breaking provider changes with one local Go binary." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const applicationSchema = z.object({
  workEmail: z.string().trim().email("Enter a valid work email.").max(254),
  company: z.string().trim().min(1, "Enter your company name.").max(120),
  providers: z.string().trim().min(1, "Tell us which providers you depend on.").max(500),
  currentBreakage: z.string().trim().max(2000, "Keep this under 2,000 characters."),
});

type FormFields = z.infer<typeof applicationSchema>;
type FieldErrors = Partial<Record<keyof FormFields | "form", string>>;

const github = "https://github.com/pikopod/pikopod";

function Terminal({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="terminal" aria-label={label}>
      <div className="terminal-bar"><span className="terminal-mark" />pikopod<span className="ml-auto text-subtle">~/api</span></div>
      <pre><code>{children}</code></pre>
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("pikopod-theme");
    const nextDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", nextDark);
    setDark(nextDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("pikopod-theme", next ? "dark" : "light");
    setDark(next);
  };

  return <Button variant="quiet" size="icon" onClick={toggle} aria-label={`Use ${dark ? "light" : "dark"} theme`}>{dark ? <Sun size={16} /> : <Moon size={16} />}</Button>;
}

function ApplicationForm() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = {
      workEmail: String(form.get("workEmail") ?? ""),
      company: String(form.get("company") ?? ""),
      providers: String(form.get("providers") ?? ""),
      currentBreakage: String(form.get("currentBreakage") ?? ""),
    };
    const parsed = applicationSchema.safeParse(values);
    if (!parsed.success) {
      const next: FieldErrors = {};
      parsed.error.issues.forEach((issue) => { next[issue.path[0] as keyof FormFields] = issue.message; });
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const { error } = await supabase.from("design_partner_applications").insert({
      work_email: parsed.data.workEmail,
      company: parsed.data.company,
      providers: parsed.data.providers,
      current_breakage: parsed.data.currentBreakage || null,
    });
    setSubmitting(false);
    if (error) {
      setErrors({ form: "We couldn't save your application. Please try again." });
      return;
    }
    setSubmitted(true);
  }

  if (submitted) return <div className="success-panel" role="status"><span className="label">APPLICATION RECEIVED</span><p>Thanks — we'll be in touch within two working days.</p></div>;

  const field = (name: keyof FormFields) => errors[name] ? <p className="field-error" id={`${name}-error`}>{errors[name]}</p> : null;
  return (
    <form onSubmit={submit} noValidate className="application-form">
      <div className="form-row">
        <label>Work email<input name="workEmail" type="email" autoComplete="email" aria-describedby="workEmail-error" required /></label>
        <label>Company<input name="company" autoComplete="organization" aria-describedby="company-error" required /></label>
      </div>
      <div className="error-row">{field("workEmail")}{field("company")}</div>
      <label>Which providers do you depend on?<input name="providers" placeholder="Stripe, Plaid, an internal billing service..." aria-describedby="providers-error" required /></label>
      {field("providers")}
      <label>What breaks today? <span className="text-subtle">(optional)</span><textarea name="currentBreakage" rows={5} aria-describedby="currentBreakage-error" /></label>
      {field("currentBreakage")}
      {errors.form && <p className="field-error" role="alert">{errors.form}</p>}
      <Button type="submit" disabled={submitting}>{submitting ? "Sending…" : "Apply"}</Button>
    </form>
  );
}

function Index() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="site-header">
        <a className="wordmark" href="#top">pikopod<span className="cursor-mark">_</span></a>
        <nav aria-label="Primary navigation">
          <a href={`${github}#readme`}>Docs</a><a href={github}>GitHub</a><ThemeToggle />
          <a className="nav-cta" href="#apply">Apply as a design partner</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero shell">
          <div className="eyebrow">Accepting design partners for Q4 2026</div>
          <h1>Your API providers change things without telling you.</h1>
          <p className="hero-copy">pikopod watches both sides — the specs they publish and the bytes they actually send — and tells you the moment either stops matching what you built against. Before your customers find out.</p>
          <p className="mono-note">One Go binary. Runs locally. Nothing leaves your machine.</p>
          <Terminal label="Example pikopod drift report"><><span className="err">[ERR]</span> pikopod drift — new value on GET /transaction/tx_{"{id}"} (examplepay){"\n"}<span className="field">status:</span> value "succeeded" not in known set [success]{"\n"}<span className="field">fingerprint</span> fp_385153d1776c · <span className="field">first seen</span> 2026-09-11T00:08:54Z · 3 occurrence(s){"\n"}<span className="field">replay it:</span> pikopod scenario from-drift fp_385153d1776c</></Terminal>
          <p className="terminal-caption">One letter. Your <code>if status == "success"</code> stops matching and payments start looking unsettled. Nobody's changelog mentioned it.</p>
          <div className="actions"><a className="button-link primary-link" href="#apply">Apply as a design partner</a><a className="button-link outline-link" href={github}>View on GitHub</a></div>
        </section>

        <section className="section shell" id="ci">
          <div className="section-heading"><span className="index">01 / EARLY SIGNAL</span><h2>Start in your CI, not your production path</h2><p>The cheapest thing pikopod does needs no proxy, no account and no setup: it diffs two versions of a spec and fails the build on a breaking change.</p></div>
          <Terminal label="Example specification diff"><><span className="prompt">$</span> pikopod spec-diff git:origin/main:openapi.yaml openapi.yaml --fail-on ERR{"\n\n"}1 change(s): 1 ERR, 0 WARN, 0 INFO{"\n\n"}<span className="err">ERR</span>  GET  /charges/{"{id}"}          response-required-property-removed{"\n"}     response 200 (application/json) field <span className="field">`status`</span> (guaranteed) removed{"\n"}     — consumers reading it break  [fp_57f7a3158a88]{"\n\n"}<span className="err">breaking declared drift at/above ERR — failing the gate (exit 1)</span></></Terminal>
          <p className="mono-note mt-5">It reads straight from git with no checkout. Exit <code>0</code> clean, <code>1</code> breaking, <code>2</code> tool error.</p>
        </section>

        <section className="section shell" id="both-sides">
          <div className="section-heading"><span className="index">02 / CORRELATION</span><h2>Both sides</h2></div>
          <div className="signal-grid">
            <article><span className="signal-label"><i className="info-dot" />DECLARED</span><h3>What they published</h3><p>We re-fetch the spec your provider publishes and diff it against the version you pinned. Severity is derived from the shape of the change — never hand-assigned — so "breaking" means the same thing on every endpoint.</p></article>
            <article><span className="signal-label"><i className="warn-dot" />OBSERVED</span><h3>What they sent</h3><p>A fail-open reverse proxy sits in front of your provider. It forwards everything untouched, learns what normal looks like, then reports structural changes in the responses you actually receive.</p></article>
            <div className="join"><span className="join-line" /><div><span className="signal-label">THE JOIN</span><h3>Evidence changes the verdict.</h3><p>Traffic evidence raises the severity of a declared change. A declared change downgrades an observed one to documented rather than silent. Nobody else holds both sides.</p></div></div>
          </div>
        </section>

        <section className="section shell" id="safety">
          <div className="section-heading"><span className="index">03 / FAILURE MODE</span><h2>Safe in front of money</h2></div>
          <div className="safety-list">
            <article><span>01</span><div><h3>It serves first and observes afterwards.</h3><p>Observation is asynchronous and bounded; every capture stage is isolated and counted. If pikopod breaks internally, your traffic still flows.</p></div></article>
            <article><span>02</span><div><h3>It never retries.</h3><p>An automatic retry in front of a payments API is a double-charge window.</p></div></article>
            <article><span>03</span><div><h3>It redacts before the disk, not after.</h3><p>Credentials become placeholders and identifiers become format-preserving tokens. <code>pikopod inspect</code> shows you exactly what was kept.</p></div></article>
            <article><span>04</span><div><h3>It initiates no network traffic of its own.</h3><p>Your Slack webhook, your git forge, your own model key — all because you configured them.</p></div></article>
          </div>
        </section>

        <section className="partner-section" id="apply"><div className="shell partner-grid">
          <div className="partner-copy"><span className="index">04 / DESIGN PARTNERS</span><h2>Accepting design partners for Q4 2026</h2><p>pikopod is open source and works today. We're looking for a small number of teams who depend on third-party APIs in production and are willing to run it against a real provider while we build the hosted layer.</p>
            <div className="terms"><div><h3>What you get</h3><p>Direct line to the maintainer. Your provider's quirks shape what gets built. Free access to the hosted layer through the program and preferential pricing after.</p></div><div><h3>What we ask</h3><p>Run pikopod against at least one provider you actually depend on. A short call every two weeks. Tell us when it's wrong.</p></div></div>
          </div><ApplicationForm />
        </div></section>
      </main>

      <footer><div className="shell footer-grid"><div><a className="wordmark" href="#top">pikopod_</a><p>pikopod is open source under Apache-2.0.</p></div><div><h3>Product</h3><a href={`${github}#readme`}>Docs</a><a href={github}>GitHub</a><a href={`${github}/releases`}>Releases</a></div><div><h3>Project</h3><a href={`${github}/blob/main/CONTRIBUTING.md`}>Contributing</a><a href={`${github}/security/policy`}>Security policy</a><a href={`${github}/blob/main/CODE_OF_CONDUCT.md`}>Code of conduct</a></div><div><h3>Legal</h3><a href={`${github}/blob/main/LICENSE`}>Apache-2.0</a></div></div></footer>
    </div>
  );
}