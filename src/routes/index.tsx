import { createFileRoute } from "@tanstack/react-router";
import { Children, cloneElement, FormEvent, isValidElement, ReactNode, useEffect, useRef, useState } from "react";
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

function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return "";
}

function afterFirstLine(node: ReactNode, remaining: { count: number }): ReactNode {
  if (typeof node === "string" || typeof node === "number") {
    const text = String(node);
    if (remaining.count >= text.length) {
      remaining.count -= text.length;
      return null;
    }
    const result = text.slice(remaining.count);
    remaining.count = 0;
    return result;
  }
  if (Array.isArray(node)) return node.map((child) => afterFirstLine(child, remaining));
  if (isValidElement<{ children?: ReactNode }>(node)) {
    const nextChildren = Children.map(node.props.children, (child) => afterFirstLine(child, remaining));
    return cloneElement(node, undefined, nextChildren);
  }
  return node;
}

function Terminal({ children, label }: { children: React.ReactNode; label: string }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const fullText = nodeText(children);
  const firstBreak = fullText.indexOf("\n");
  const command = firstBreak === -1 ? fullText : fullText.slice(0, firstBreak);
  const result = firstBreak === -1 ? null : afterFirstLine(children, { count: firstBreak + 1 });
  const [typedLength, setTypedLength] = useState(command.length);
  const [showResult, setShowResult] = useState(true);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let typingTimer: number | undefined;
    let resultTimer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        terminal.classList.add("terminal-active");
        setTypedLength(0);
        setShowResult(false);
        let index = 0;
        const speed = Math.max(12, Math.min(34, 1050 / Math.max(command.length, 1)));
        typingTimer = window.setInterval(() => {
          index += 1;
          setTypedLength(Math.min(index, command.length));
          if (index < command.length) return;
          window.clearInterval(typingTimer);
          resultTimer = window.setTimeout(() => setShowResult(true), 260);
        }, speed);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );

    observer.observe(terminal);
    return () => {
      observer.disconnect();
      if (typingTimer) window.clearInterval(typingTimer);
      if (resultTimer) window.clearTimeout(resultTimer);
    };
  }, [command]);

  return (
    <div className="terminal" aria-label={label} ref={terminalRef}>
      <div className="terminal-bar"><span className="terminal-mark" /><span className="terminal-title">pikopod</span><span className="terminal-activity" aria-hidden="true" /><span className="ml-auto text-subtle">~/api</span></div>
      <pre className="terminal-content">
        <code className="terminal-measure" aria-hidden="true">{children}</code>
        <code className="terminal-live"><span className="terminal-command">{command.slice(0, typedLength)}</span>{typedLength < command.length && <span className="terminal-caret" aria-hidden="true" />}{showResult && result && <span className="terminal-result">{"\n"}{result}</span>}</code>
      </pre>
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
          <div className="hero-grid">
            <div className="hero-intro">
              <div className="eyebrow"><span className="status-dot" />Accepting design partners for Q4 2026</div>
              <h1>Your API providers change things <span>without telling you.</span></h1>
              <p className="hero-copy">pikopod gives you a deterministic sandbox built from your provider's spec, failure scenarios that bind themselves to your API, and a drift agent that catches the changes your provider never announced.</p>
              <div className="actions"><a className="button-link primary-link" href="#apply">Apply as a design partner</a><a className="button-link outline-link" href={github}>View on GitHub</a></div>
            </div>
            <div className="hero-evidence">
              <Terminal label="Example pikopod drift report"><><span className="err">[ERR]</span> pikopod drift — new value on GET /transaction/tx_{"{id}"} (examplepay){"\n"}<span className="field">status:</span> value "succeeded" not in known set [success]{"\n"}<span className="field">fingerprint</span> fp_385153d1776c · <span className="field">first seen</span> 2026-09-11T00:08:54Z · 3 occurrence(s){"\n"}<span className="field">replay it:</span> pikopod scenario from-drift fp_385153d1776c</></Terminal>
              <p className="terminal-caption">One letter. Your <code>if status == "success"</code> stops matching and payments start looking unsettled.</p>
            </div>
          </div>
          <div className="hero-facts" aria-label="Product characteristics"><div><span>Runtime</span><strong>One Go binary</strong></div><div><span>Execution</span><strong>Runs locally</strong></div><div><span>Data boundary</span><strong>Nothing leaves your machine</strong></div></div>
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

        <section className="section shell" id="tenses">
          <div className="section-heading"><span className="index">03 / FRAMING</span><h2>Three tenses of one question</h2><p>Everything pikopod does answers one question — <em>what is this API about to do to me?</em> — asked about three different times.</p></div>
          <div className="tense-grid">
            <div />
            <div className="tense-head">Sandbox</div>
            <div className="tense-head">Drift agent</div>
            <div className="tense-head">Replay</div>

            <div className="tense-key">Tense</div>
            <div><p>Future</p></div>
            <div><p>Present</p></div>
            <div><p>Past</p></div>

            <div className="tense-key">Answers</div>
            <div><p>What happens when they ship the new spec? When they decline, or time out?</p></div>
            <div><p>Did it actually happen, and is it on my wire now?</p></div>
            <div><p>What exactly happened — prove the fix against it.</p></div>

            <div className="tense-key">Needs</div>
            <div><p>A spec. Works on day one.</p></div>
            <div><p>48 hours of traffic.</p></div>
            <div><p>It to have already broken.</p></div>
          </div>
          <p className="after-note">Each covers what the others structurally cannot.</p>
        </section>

        <section className="section shell" id="sandbox">
          <div className="section-heading"><span className="index">04 / SANDBOX</span><h2>A sandbox that behaves like your provider</h2><p>Point your staging environment at pikopod instead of the provider's own sandbox. It is built from their spec, and it is deterministic — same seed, same bytes, every run. Unlike the provider's sandbox, you can make it misbehave on purpose.</p></div>
          <Terminal label="Example sandbox import and serve"><><span className="prompt">$</span> pikopod import examplepay --spec https://api.examplepay.com/openapi.json{"\n"}<span className="prompt">$</span> pikopod up{"\n\n"}sandbox examplepay registered (sbx_dd9b07b7e373574d, 53 endpoints){"\n"}serve it with `pikopod up` → http://127.0.0.1:4600/examplepay/...</></Terminal>
          <div className="sub-block">
            <h3>Make it fail on demand</h3>
            <Terminal label="Example chaos fault injection"><><span className="prompt">$</span> pikopod chaos examplepay --kind error --status 503 --method POST --path /v1/charges{"\n\n"}armed: {"{"}"method":"POST","path":"/v1/charges","kind":"error","status":503,"probability":1{"}"}</></Terminal>
            <p className="mono-note">Fault kinds are <code>error</code>, <code>latency</code>, <code>hang</code>, <code>slow_body</code> and <code>rate_limit</code>. The provider's own sandbox will not do any of these for you.</p>
          </div>
        </section>

        <section className="section section-emphasis" id="scenarios"><div className="shell">
          <div className="section-heading"><span className="index">05 / SCENARIOS</span><h2>Failure scenarios that bind to your API</h2><p>pikopod ships eleven provider-agnostic failure stories — declines, timeouts, duplicate delivery, rate-limit backoff, partial failure, downtime recovery and more. You do not write them. They bind themselves to your API from its spec, and tell you which ones your integration can actually support.</p></div>
          <Terminal label="Example scenario archetype listing"><><span className="prompt">$</span> pikopod scenario list examplepay{"\n\n"}archetypes vs examplepay (53 endpoints):{"\n"}  <span className="ok">✓</span> happy_path                 Happy path  (15 candidate binding(s)){"\n"}  <span className="ok">✓</span> unauthorized               Unauthorized  (25 candidate binding(s)){"\n"}  <span className="warn">✗</span> invalid_request            Invalid request{"\n"}      <span className="dim">no operation matching {"{"}"crud":"CREATE","hasErrorResponseClass":"4XX"{"}"} for role 'op'</span>{"\n"}  <span className="ok">✓</span> rate_limit_backoff         Rate limit and backoff  (25 candidate binding(s)){"\n"}  <span className="warn">✗</span> duplicate_delivery         Duplicate delivery{"\n"}      <span className="dim">no webhookEvent matching {"{}"} for role 'emittedEvent'</span>{"\n"}  <span className="ok">✓</span> retry_storm                Retry storm with recovery  (7 candidate binding(s)){"\n"}  <span className="ok">✓</span> declines                   Declines  (7 candidate binding(s)){"\n"}  <span className="ok">✓</span> timeouts                   Timeouts  (15 candidate binding(s))</></Terminal>
          <p className="callout"><strong>A refusal is an answer.</strong> When an archetype cannot bind, pikopod says which role it could not fill and why. It will not bind on a guess, because a test resting on a guess fails for reasons that have nothing to do with your code.</p>
          <div className="sub-block">
            <Terminal label="Example scenario run"><><span className="prompt">$</span> pikopod scenario run examplepay declines timeouts partial_failure</></Terminal>
          </div>
        </div></section>

        <section className="section shell" id="describe">
          <div className="section-heading"><span className="index">06 / GROUNDED GENERATION</span><h2>Describe a failure in English</h2><p>Bring your own model key and describe the scenario you want. The model never writes test steps — it picks from the archetypes that actually bind to your API and fills in operations that actually exist. It cannot invent an endpoint.</p></div>
          <Terminal label="Example scenario creation from a description"><><span className="prompt">$</span> pikopod scenario create examplepay "a timeout after the charge succeeds"{"\n\n"}grounding "a timeout after the charge succeeds" against examplepay{"\n"}  (53 operations, 8 applicable archetypes)…</></Terminal>
          <p className="callout"><strong>The model is fenced, not trusted.</strong> It emits a constrained intent, validated against a closed inventory built from your imported spec. Anything outside that inventory is a typed refusal rather than a broken test. It must also declare what your description asked for that it could not capture.</p>
          <p className="mono-note">Optional. Everything else on this page works with no model key at all.</p>
        </section>

        <section className="section shell" id="replay">
          <div className="section-heading"><span className="index">07 / REPLAY</span><h2>Replay your own production traffic</h2><p>The drift agent records the traffic it observes — redacted before it touches disk. Those recordings become fixtures: the sandbox serves them for requests the spec cannot answer, and CI replays them offline to gate a build.</p></div>
          <Terminal label="Example offline replay in CI"><><span className="prompt">$</span> pikopod replay --ci</></Terminal>
          <p className="mono-note">Exit <code>0</code> clean, <code>1</code> drift found, <code>2</code> tool error. No network, no provider, no staging environment.</p>
          <div className="tier-list">
            <article><h3>exact</h3><p>Method, path and a normalised body hash.</p></article>
            <article><h3>shape</h3><p>Method, path template and the body's field set, values ignored.</p></article>
            <article><h3>sequence</h3><p>The next unserved recording for that method and template.</p></article>
          </div>
          <p className="after-note">Every response names the tier it was served from, so a degraded match is visible rather than silent.</p>
        </section>

        <section className="section shell" id="safety">
          <div className="section-heading"><span className="index">08 / FAILURE MODE</span><h2>Safe in front of money</h2></div>

          <div className="safety-list">
            <article><span>01</span><div><h3>It serves first and observes afterwards.</h3><p>Observation is asynchronous and bounded; every capture stage is isolated and counted. If pikopod breaks internally, your traffic still flows.</p></div></article>
            <article><span>02</span><div><h3>It never retries.</h3><p>An automatic retry in front of a payments API is a double-charge window.</p></div></article>
            <article><span>03</span><div><h3>It redacts before the disk, not after.</h3><p>Credentials become placeholders and identifiers become format-preserving tokens. <code>pikopod inspect</code> shows you exactly what was kept.</p></div></article>
            <article><span>04</span><div><h3>It initiates no network traffic of its own.</h3><p>Your Slack webhook, your git forge, your own model key — all because you configured them.</p></div></article>
          </div>
        </section>

        <section className="partner-section" id="apply"><div className="shell partner-grid">
          <div className="partner-copy"><span className="index">09 / DESIGN PARTNERS</span><h2>Accepting design partners for Q4 2026</h2><p>pikopod is open source and works today. We're looking for a small number of teams who depend on third-party APIs in production and are willing to run it against a real provider while we build the hosted layer.</p>
            <div className="terms"><div><h3>What you get</h3><p>Direct line to the maintainer. Your provider's quirks shape what gets built. Free access to the hosted layer through the program and preferential pricing after.</p></div><div><h3>What we ask</h3><p>Run pikopod against at least one provider you actually depend on. A short call every two weeks. Tell us when it's wrong.</p></div></div>
          </div><ApplicationForm />
        </div></section>
      </main>

      <footer><div className="shell footer-grid"><div><a className="wordmark" href="#top">pikopod_</a><p>pikopod is open source under Apache-2.0.</p></div><div><h3>Product</h3><a href={`${github}#readme`}>Docs</a><a href={github}>GitHub</a><a href={`${github}/releases`}>Releases</a></div><div><h3>Project</h3><a href={`${github}/blob/main/CONTRIBUTING.md`}>Contributing</a><a href={`${github}/security/policy`}>Security policy</a><a href={`${github}/blob/main/CODE_OF_CONDUCT.md`}>Code of conduct</a></div><div><h3>Legal</h3><a href={`${github}/blob/main/LICENSE`}>Apache-2.0</a></div></div></footer>
    </div>
  );
}