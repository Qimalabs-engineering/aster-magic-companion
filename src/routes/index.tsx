import { createFileRoute } from "@tanstack/react-router";
import { Children, cloneElement, FormEvent, isValidElement, ReactNode, useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "pikopod — rehearse the failures, reproduce the ones you missed" },
      { name: "description", content: "An open-source sandbox for the APIs you depend on. Make it fail on purpose before you ship, and replay the exact failure production hit." },
      { property: "og:title", content: "pikopod — rehearse the failures, reproduce the ones you missed" },
      { property: "og:description", content: "An open-source sandbox for the APIs you depend on. Make it fail on purpose before you ship, and replay the exact failure production hit." },
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
              <h1>Their sandbox only knows <span>how to succeed.</span></h1>
              <p className="hero-copy">It has never declined a charge in a way you didn't ask for, never timed out halfway through, never delivered the same webhook twice. So the first time your retry path runs for real, it runs against real money.</p>
              <p className="hero-copy">pikopod builds a sandbox from your provider's own spec, makes it fail on purpose, and — when something goes wrong in production anyway — replays that exact failure back into it.</p>
              <div className="actions"><a className="button-link primary-link" href="#apply">Apply as a design partner</a><a className="button-link outline-link" href={github}>View on GitHub</a></div>
            </div>
            <div className="hero-evidence">
              <Terminal label="Example scenario listing and run"><><span className="prompt">$</span> pikopod scenario list examplepay{"\n"}archetypes vs examplepay (4 endpoints):{"\n"}  <span className="ok">✓</span> declines                   Declines  (1 candidate binding(s)){"\n"}  <span className="ok">✓</span> timeouts                   Timeouts  (1 candidate binding(s)){"\n"}  <span className="ok">✓</span> retry_storm                Retry storm with recovery  (1 candidate binding(s)){"\n"}  <span className="warn">✗</span> duplicate_delivery         Duplicate delivery{"\n"}      <span className="dim">no webhookEvent matching {"{}"} for role 'emittedEvent'</span>{"\n\n"}<span className="prompt">$</span> pikopod scenario run examplepay declines retry_storm{"\n"}<span className="ok">✓</span> declines — PASSED (4 assertion(s) passed; 0 not evaluated){"\n"}    PASSED         declined         POST /charges → 400{"\n"}    PASSED         recovered        POST /charges → 201{"\n"}<span className="ok">✓</span> retry_storm — PASSED (4 assertion(s) passed; 0 not evaluated){"\n"}    PASSED         attempt1         POST /charges → 503{"\n"}    PASSED         attempt2         POST /charges → 503{"\n"}    PASSED         attempt3         POST /charges → 201</></Terminal>
              <p className="terminal-caption">No proxy, no account, nothing in your request path — and nothing to author. The failure stories bind themselves to your API from its spec, and the one that cannot bind says which fact was missing rather than guessing a test into existence.</p>
            </div>
          </div>
          <div className="hero-facts" aria-label="Product characteristics"><div><span>Runtime</span><strong>One Go binary</strong></div><div><span>Execution</span><strong>Runs locally</strong></div><div><span>Data boundary</span><strong>Nothing leaves unless you configure it</strong></div></div>
        </section>

        <section className="section shell" id="loop">
          <div className="section-heading"><span className="index">02 / THE LOOP</span><h2>One loop, not three tools</h2><p>Detecting the change is the easy part. The rest is being able to reproduce it, fix it, and keep it fixed. pikopod is one cycle, and each stage feeds the next.</p></div>
          <div className="loop-table">
            <div className="loop-num">1</div><div><strong>Integrate</strong> — a spec becomes a stateful sandbox</div><div><code>pikopod import</code></div>
            <div className="loop-num">2</div><div><strong>Rehearse</strong> — every failure production will throw, not just the happy path</div><div><code>pikopod scenario list</code> · <code>run</code> · <code>chaos</code></div>
            <div className="loop-num">3</div><div><strong>Ship</strong></div><div>—</div>
            <div className="loop-num">4</div><div><strong>Observe</strong> — a proxy watches your traffic for failures and shape changes, while the spec watcher watches what they publish</div><div><code>pikopod up</code> · <code>incidents</code></div>
            <div className="loop-num">5</div><div><strong>Reproduce</strong> — the failure becomes a runnable scenario in that same sandbox</div><div><code>pikopod scenario reproduce</code></div>
            <div className="loop-num">6</div><div><strong>Fix and prove</strong></div><div><code>pikopod fix</code> · <code>scenario run</code></div>
            <div className="loop-num">7</div><div><strong>Regress forever</strong></div><div><code>pikopod replay --ci</code></div>
          </div>
          <p className="callout"><strong>Stage 5 is the one nothing else does.</strong> You cannot ask a provider's sandbox to return that exact 503, with that body, at that point in your state machine. pikopod can, because the same tool recorded it and owns the sandbox. Mocking tools have a sandbox and no observer. Monitoring tools have an observer and no sandbox.</p>
          <p className="after-note">You do not have to adopt all of it. Stages 1–2 need no proxy and nothing in your request path, and that is where most people start.</p>
        </section>

        <section className="section section-emphasis" id="reproduction"><div className="shell">
          <div className="section-heading"><span className="index">03 / REPRODUCTION</span><h2>Replay last Friday's 503 on your laptop</h2><p>Your provider returned 503 to <code>POST /charges</code> for ninety seconds. Forty charges are in a state your code has never been in, and you cannot reproduce it — their sandbox will not return a 503 on request, and if it would, it would not return <em>that</em> 503, with <em>that</em> body, at <em>that</em> point in your state machine.</p></div>
          <Terminal label="Example incident reproduction"><><span className="prompt">$</span> pikopod incidents{"\n"}<span className="err">[ERR]</span> incident upstream_error  POST /charges (examplepay) · 3 occurrence(s){"\n"}  fp_14835fa32dfb{"\n"}  <span className="field">reproduce:</span> pikopod scenario reproduce fp_14835fa32dfb{"\n\n"}<span className="prompt">$</span> pikopod scenario reproduce fp_14835fa32dfb{"\n"}reproduced fp_14835fa32dfb (examplepay answered 503 on POST /charges){"\n"}  → pikopod-data/scenarios/incident-14835fa32dfb.yaml{"\n"}<span className="ok">PASSED</span> — 1 assertion(s) passed; 0 not evaluated</></Terminal>
          <p className="terminal-caption"><code>reproduce</code> arms the same failure in your sandbox and replays the recorded request at it, so the break happens on your laptop instead of in production. The generated pack is an ordinary scenario — commit it and it guards that path forever.</p>
          <p className="callout"><strong>Reproduced requests are rebuilt from redacted recordings.</strong> Identifiers are format-preserving tokens, and anything the sanitizer could not classify was dropped before it reached disk. Every generated pack says so. For a 5xx or a timeout that changes nothing — the fault is armed on method and path. For a 4xx your own payload caused, the body matters.</p>
        </div></section>

        <section className="section shell" id="sandbox">
          <div className="section-heading"><span className="index">04 / SANDBOX</span><h2>A sandbox that behaves like your provider</h2><p>Point your staging environment at pikopod instead of the provider's own sandbox. It is built from their spec, and it is deterministic — same seed, same bytes, every run. Unlike the provider's sandbox, you can make it misbehave on purpose.</p></div>
          <Terminal label="Example sandbox import and serve"><><span className="prompt">$</span> pikopod import examplepay --spec https://api.examplepay.com/openapi.json{"\n"}<span className="prompt">$</span> pikopod up{"\n\n"}sandbox examplepay registered (4 endpoints){"\n"}serve it with `pikopod up` → http://127.0.0.1:4600/examplepay/...</></Terminal>
          <div className="sub-block">
            <h3>Make it fail on demand</h3>
            <Terminal label="Example chaos fault injection"><><span className="prompt">$</span> pikopod chaos examplepay --kind error --status 503 --method POST --path /v1/charges{"\n\n"}armed: {"{"}"method":"POST","path":"/v1/charges","kind":"error","status":503,"probability":1{"}"}</></Terminal>
            <p className="mono-note">Twelve fault kinds: <code>error</code>, <code>latency</code>, <code>hang</code>, <code>slow_body</code>, <code>rate_limit</code>, <code>connection_reset</code>, <code>malformed_response</code>, <code>wrong_content_length</code>, and the webhook faults <code>duplicate_webhook</code>, <code>drop_webhook</code>, <code>reorder_webhook</code> and <code>delay_webhook</code>. <code>duplicate_webhook</code> is the double-charge story. The provider's own sandbox will not do any of these for you.</p>
          </div>
          <div className="sub-block">
            <h3>Does it work on a real API?</h3>
            <p className="hero-copy">Stripe publishes its OpenAPI document under MIT. 419 paths and 7.7 MB become 594 endpoints in about 0.13 seconds, and eight of the eleven archetypes bind.</p>
            <p className="hero-copy">Three do not, and that is the part worth reading. <code>invalid_request</code> cannot bind because Stripe declares no 4xx response on any of its 297 POST operations — errors go through <code>default</code>. So pikopod names the fact that was missing instead of guessing a test into existence. You can check that with <code>jq</code> in a minute.</p>
            <p className="mono-note">This is not a claim that pikopod supports Stripe, and it is not an endorsement by them. It is one reproducible run against a public document.</p>
          </div>
        </section>

        <section className="section shell" id="scenarios">
          <div className="section-heading"><span className="index">05 / SCENARIOS</span><h2>Failure scenarios that bind to your API</h2><p>pikopod ships eleven provider-agnostic failure stories — declines, timeouts, duplicate delivery, rate-limit backoff, partial failure, downtime recovery and more. You do not write them. They bind themselves to your API from its spec, and tell you which ones your integration can actually support.</p></div>
          <Terminal label="Example scenario archetype listing"><><span className="prompt">$</span> pikopod scenario list examplepay{"\n\n"}archetypes vs examplepay (4 endpoints):{"\n"}  <span className="ok">✓</span> happy_path                 Happy path  (1 candidate binding(s)){"\n"}  <span className="ok">✓</span> unauthorized               Unauthorized  (1 candidate binding(s)){"\n"}  <span className="warn">✗</span> invalid_request            Invalid request{"\n"}      <span className="dim">no operation matching {"{"}"crud":"CREATE","hasErrorResponseClass":"4XX"{"}"} for role 'op'</span>{"\n"}  <span className="ok">✓</span> rate_limit_backoff         Rate limit and backoff  (1 candidate binding(s)){"\n"}  <span className="warn">✗</span> duplicate_delivery         Duplicate delivery{"\n"}      <span className="dim">no webhookEvent matching {"{}"} for role 'emittedEvent'</span>{"\n"}  <span className="ok">✓</span> retry_storm                Retry storm with recovery  (1 candidate binding(s)){"\n"}  <span className="ok">✓</span> declines                   Declines  (1 candidate binding(s)){"\n"}  <span className="ok">✓</span> timeouts                   Timeouts  (1 candidate binding(s))</></Terminal>
          <p className="callout"><strong>A refusal is an answer.</strong> When an archetype cannot bind, pikopod says which role it could not fill and why. It will not bind on a guess, because a test resting on a guess fails for reasons that have nothing to do with your code.</p>
        </section>

        <section className="section shell" id="observe">
          <div className="section-heading"><span className="index">06 / OBSERVE</span><h2>Incidents and drift</h2></div>
          <div className="tier-list">
            <article><h3>incidents</h3><p>The upstream answered 5xx, throttled you with a 429, or could not be reached at all. These are facts about one request, so they need no baseline and fire from the very first one.</p></article>
            <article><h3>drift</h3><p>The shape of a successful response changed. This needs a baseline, so it stays quiet for the first 50 samples <strong>and</strong> 48 hours — both gates, not either: a reference built from five responses hasn't seen your optional fields yet.</p></article>
          </div>
          <div className="signal-grid mt-10">
            <article><span className="signal-label"><i className="info-dot" />DECLARED</span><h3>What they published</h3><p>We re-fetch the spec your provider publishes and diff it against the version you pinned. Severity is derived from the shape of the change — never hand-assigned — so "breaking" means the same thing on every endpoint.</p></article>
            <article><span className="signal-label"><i className="warn-dot" />OBSERVED</span><h3>What they sent</h3><p>A fail-open reverse proxy sits in front of your provider. It forwards everything untouched, learns what normal looks like, then reports structural changes in the responses you actually receive.</p></article>
            <div className="join"><span className="join-line" /><div><span className="signal-label">THE JOIN</span><h3>Evidence changes the verdict.</h3><p>Traffic evidence raises the severity of a declared change. A declared change downgrades an observed one to documented rather than silent. Holding both sides is <strong>why</strong> a reproduction is possible at all. It is the architecture; stage 5 is what the architecture is for.</p></div></div>
          </div>
        </section>

        <section className="section shell" id="describe">
          <div className="section-heading"><span className="index">07 / GROUNDED GENERATION</span><h2>Describe a failure in English</h2><p>Bring your own model key and describe the scenario you want. The model never writes test steps — it picks from the archetypes that actually bind to your API and fills in operations that actually exist. It cannot invent an endpoint.</p></div>
          <Terminal label="Example scenario creation from a description"><><span className="prompt">$</span> pikopod scenario create examplepay "a timeout after the charge succeeds"{"\n\n"}grounding "a timeout after the charge succeeds" against examplepay{"\n"}  (4 operations, 8 applicable archetypes)…</></Terminal>
          <p className="callout"><strong>The model is fenced, not trusted.</strong> It emits a constrained intent, validated against a closed inventory built from your imported spec. Anything outside that inventory is a typed refusal rather than a broken test. It must also declare what your description asked for that it could not capture.</p>
          <p className="mono-note">Optional. Everything else on this page works with no model key at all.</p>
        </section>

        <section className="section shell" id="replay">
          <div className="section-heading"><span className="index">08 / REPLAY</span><h2>Replay your own production traffic</h2><p>The observing agent records the traffic it sees — redacted before it touches disk. Those recordings become fixtures: the sandbox serves them for requests the spec cannot answer, and CI replays them offline to gate a build.</p></div>
          <Terminal label="Example offline replay in CI"><><span className="prompt">$</span> pikopod replay --ci</></Terminal>
          <p className="mono-note">Exit <code>0</code> clean, <code>1</code> the check ran and failed, <code>2</code> tool error. No network, no provider, no staging environment.</p>
          <div className="tier-list">
            <article><h3>exact</h3><p>Method, path and a normalised body hash.</p></article>
            <article><h3>shape</h3><p>Method, path template and the body's field set, values ignored.</p></article>
            <article><h3>sequence</h3><p>The next unserved recording for that method and template.</p></article>
          </div>
          <p className="after-note">Every response names the tier it was served from, so a degraded match is visible rather than silent.</p>
          <div className="sub-block">
            <h3>Also: one line of CI that fails on a breaking spec change</h3>
            <Terminal label="Example specification diff"><><span className="prompt">$</span> pikopod spec-diff git:origin/main:openapi.yaml openapi.yaml --fail-on ERR{"\n\n"}1 change(s): 1 ERR, 0 WARN, 0 INFO{"\n\n"}<span className="err">ERR</span>  GET  /charges/{"{id}"}          response-required-property-removed{"\n"}     response 200 (application/json) field <span className="field">`status`</span> (guaranteed) removed{"\n"}     — consumers reading it break  [fp_57f7a3158a88]{"\n\n"}<span className="err">breaking declared drift at/above ERR — failing the gate (exit 1)</span></></Terminal>
            <p className="mono-note">It reads straight from git with no checkout. No proxy, no account and no setup.</p>
          </div>
        </section>

        <section className="section shell" id="safety">
          <div className="section-heading"><span className="index">09 / FAILURE MODE</span><h2>It cannot slow your traffic down</h2></div>
          <div className="bench-block">{"BenchmarkProxyServe                 82,041 ns/op\nBenchmarkProxyServeObserverWedged   81,868 ns/op"}</div>
          <p className="mono-note">Observation jammed completely — nothing draining the capture channel — serving the same workload. Under 1% apart, run to run. Both figures are a full loopback round trip on one machine, so read the difference, not the absolute.</p>
          <p className="after-note">The sandbox is not in your request path at all. It is a local binary you point staging at. This argument only applies to the observing agent, which most people adopt last.</p>

          <div className="safety-list">
            <article><span>01</span><div><h3>It serves first and observes afterwards.</h3><p>Observation is asynchronous and bounded; every capture stage is isolated and counted. If pikopod breaks internally, your traffic still flows.</p></div></article>
            <article><span>02</span><div><h3>It never retries.</h3><p>An automatic retry in front of a payments API is a double-charge window.</p></div></article>
            <article><span>03</span><div><h3>It redacts before the disk, not after.</h3><p>Credentials become placeholders and identifiers become format-preserving tokens. <code>pikopod inspect</code> shows you exactly what was kept.</p></div></article>
            <article><span>04</span><div><h3>It initiates no network traffic of its own.</h3><p>Your Slack webhook, your git forge, your own model key — all because you configured them.</p></div></article>
          </div>
        </section>

        <section className="partner-section" id="apply"><div className="shell partner-grid">
          <div className="partner-copy"><span className="index">10 / DESIGN PARTNERS</span><h2>Accepting design partners for Q4 2026</h2><p>pikopod is open source and works today. We're looking for a small number of teams who depend on third-party APIs in production and are willing to run it against a real provider while we build the hosted layer.</p>
            <div className="terms"><div><h3>What you get</h3><p>Direct line to the maintainer. Your provider's quirks shape what gets built. Free access to the hosted layer through the program and preferential pricing after.</p></div><div><h3>What we ask</h3><p>Run pikopod against at least one provider you actually depend on. A short call every two weeks. Tell us when it's wrong.</p></div></div>
          </div><ApplicationForm />
        </div></section>
      </main>

      <footer><div className="shell footer-grid"><div><a className="wordmark" href="#top">pikopod_</a><p>pikopod is open source under Apache-2.0.</p></div><div><h3>Product</h3><a href={`${github}#readme`}>Docs</a><a href={github}>GitHub</a><a href={`${github}/releases`}>Releases</a></div><div><h3>Project</h3><a href={`${github}/blob/main/CONTRIBUTING.md`}>Contributing</a><a href={`${github}/security/policy`}>Security policy</a><a href={`${github}/blob/main/CODE_OF_CONDUCT.md`}>Code of conduct</a></div><div><h3>Legal</h3><a href={`${github}/blob/main/LICENSE`}>Apache-2.0</a></div></div></footer>
    </div>
  );
}