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
          <a href="#sandbox">Sandbox</a><a href="#reproduce">Reproduce</a><a href={github}>GitHub</a><ThemeToggle />
          <a className="nav-cta" href="#apply">Apply</a>
        </nav>
      </header>

      <main id="top">
        <section className="story-hero shell">
          <div className="story-hero-copy">
            <p className="chapter-label"><span className="status-dot" />Open source · accepting design partners</p>
            <h1>Rehearse API failures before you ship, and replay the ones production already hit.</h1>
            <p>pikopod builds a deterministic sandbox from your provider’s spec, rehearses the failure paths their sandbox cannot, and reproduces the failures production still finds.</p>
            <div className="actions"><a className="button-link primary-link" href="#sandbox">See the workflow</a><a className="button-link outline-link" href={github}>View on GitHub</a></div>
          </div>
          <div className="story-hero-proof">
            <Terminal label="Example pikopod scenario run"><><span className="prompt">$</span> pikopod scenario run examplepay declines retry_storm{"\n"}<span className="ok">✓</span> declines — PASSED{"\n"}    declined       POST /charges → 400{"\n"}    recovered      POST /charges → 201{"\n"}<span className="ok">✓</span> retry_storm — PASSED{"\n"}    attempt1       POST /charges → 503{"\n"}    attempt2       POST /charges → 503{"\n"}    attempt3       POST /charges → 201</></Terminal>
          </div>
          <div className="story-facts" aria-label="Product characteristics"><span>One Go binary</span><span>Runs locally</span><span>Nothing leaves unless you configure it</span></div>
        </section>

        <section className="story-section" id="sandbox"><div className="shell story-grid">
          <div className="story-copy">
            <span className="chapter-label">Rehearse</span>
            <h2>A sandbox you can make fail on purpose</h2>
            <p>Point staging at pikopod instead of the provider’s sandbox. It is built from their spec and deterministic: the same seed returns the same bytes.</p>
            <p>Then arm the failure you need to test. Timeouts, rate limits, malformed responses, connection resets and webhook delivery faults are controlled inputs rather than production surprises.</p>
          </div>
          <div className="story-proof">
            <Terminal label="Import a provider specification and inject a fault"><><span className="prompt">$</span> pikopod import examplepay --spec openapi.json{"\n"}sandbox examplepay registered (4 endpoints){"\n"}{"\n"}<span className="prompt">$</span> pikopod chaos examplepay --kind error --status 503 --method POST --path /v1/charges{"\n"}armed: POST /v1/charges → 503</></Terminal>
            <p className="terminal-caption">No proxy, account or authored mock is required to start.</p>
          </div>
        </div></section>

        <section className="story-section story-section-alt" id="scenarios"><div className="shell story-grid story-grid-reverse">
          <div className="story-copy">
            <span className="chapter-label">Bind</span>
            <h2>Failure stories attach to the API you actually have</h2>
            <p>Eleven provider-agnostic scenarios cover declines, timeouts, retries, partial failures and webhook delivery. pikopod binds each story to operations declared in the imported spec.</p>
            <p>If the spec does not contain enough evidence, it refuses the binding and names the missing fact instead of inventing a test.</p>
          </div>
          <div className="story-proof">
            <Terminal label="List failure scenarios available for an API"><><span className="prompt">$</span> pikopod scenario list examplepay{"\n"}<span className="ok">✓</span> declines             1 binding{"\n"}<span className="ok">✓</span> timeouts             1 binding{"\n"}<span className="ok">✓</span> retry_storm          1 binding{"\n"}<span className="warn">✗</span> duplicate_delivery{"\n"}    <span className="dim">no webhook event for role 'emittedEvent'</span></></Terminal>
          </div>
        </div></section>

        <section className="story-section" id="reproduce"><div className="shell story-grid">
          <div className="story-copy">
            <span className="chapter-label">Reproduce</span>
            <h2>Replay last Friday’s 503 on your laptop</h2>
            <p>The observing agent records a redacted failure. One command arms that same response in the sandbox and replays the recorded request against it.</p>
            <p>The result is an ordinary scenario file: inspect it, commit it, and keep the production failure as a regression test.</p>
          </div>
          <div className="story-proof">
            <Terminal label="Reproduce a production incident"><><span className="prompt">$</span> pikopod scenario reproduce fp_14835fa32dfb{"\n"}reproduced examplepay 503 on POST /charges{"\n"}→ scenarios/incident-14835fa32dfb.yaml{"\n"}<span className="ok">PASSED</span> — 1 assertion passed</></Terminal>
            <p className="terminal-caption">Recordings are redacted before they touch disk. Unclassified values are dropped.</p>
          </div>
        </div></section>

        <section className="story-section story-section-alt" id="observe"><div className="shell">
          <div className="story-intro">
            <span className="chapter-label">Observe</span>
            <h2>See what changed, then keep the fix</h2>
            <p>pikopod compares what the provider declares with what your integration receives. Those two signals produce a useful verdict instead of another isolated alert.</p>
          </div>
          <div className="evidence-pair">
            <article><span className="signal-label"><i className="info-dot" />Declared</span><h3>The published contract</h3><p>A spec diff identifies breaking changes and can fail CI before they merge.</p></article>
            <article><span className="signal-label"><i className="warn-dot" />Observed</span><h3>The responses you received</h3><p>A fail-open proxy reports incidents immediately and structural drift after a stable baseline exists.</p></article>
          </div>
          <div className="story-wide-proof">
            <Terminal label="Run an offline regression check"><><span className="prompt">$</span> pikopod replay --ci{"\n"}<span className="ok">PASSED</span> 42 recordings · exact 37 · shape 5{"\n"}{"\n"}<span className="prompt">$</span> pikopod spec-diff origin/main:openapi.yaml openapi.yaml --fail-on ERR{"\n"}<span className="err">ERR</span> GET /charges/{"{id}"} response field `status` removed{"\n"}<span className="err">breaking declared drift — exit 1</span></></Terminal>
            <p className="terminal-caption">Replay runs offline. Exit 0 is clean, 1 means the check found a failure, and 2 means the tool could not run.</p>
          </div>
        </div></section>

        <section className="story-section" id="workflow"><div className="shell workflow-layout">
          <div className="story-intro">
            <span className="chapter-label">The complete loop</span>
            <h2>Each result becomes the input to the next step</h2>
            <p>You can begin with the local sandbox. Observation only enters the path when you decide to add it.</p>
          </div>
          <ol className="workflow-list">
            <li><span>01</span><div><strong>Integrate</strong><p>Import a spec into a stateful sandbox.</p></div></li>
            <li><span>02</span><div><strong>Rehearse</strong><p>Run failure scenarios before shipping.</p></div></li>
            <li><span>03</span><div><strong>Ship</strong><p>Release with the known paths covered.</p></div></li>
            <li><span>04</span><div><strong>Observe</strong><p>Capture incidents and contract drift.</p></div></li>
            <li><span>05</span><div><strong>Reproduce</strong><p>Turn the failure into a local scenario.</p></div></li>
            <li><span>06</span><div><strong>Fix and prove</strong><p>Run the scenario against the repair.</p></div></li>
            <li><span>07</span><div><strong>Regress forever</strong><p>Keep the scenario in offline CI.</p></div></li>
          </ol>
        </div></section>

        <section className="story-section story-section-alt" id="safety"><div className="shell story-grid story-grid-reverse">
          <div className="story-copy">
            <span className="chapter-label">Safety boundary</span>
            <h2>Observation cannot hold up your traffic</h2>
            <p>The proxy serves first and observes afterwards through bounded, isolated capture stages. It never retries and initiates no network traffic unless you configure an integration.</p>
            <p>Credentials are replaced and identifiers are tokenised before recordings reach disk.</p>
          </div>
          <div className="story-proof benchmark-proof">
            <div className="bench-block">{"BenchmarkProxyServe                 82,041 ns/op\nBenchmarkProxyServeObserverWedged   81,868 ns/op"}</div>
            <p className="terminal-caption">Observation fully jammed versus normal serving: under 1% apart in the same loopback benchmark.</p>
          </div>
        </div></section>

        <section className="partner-section" id="apply"><div className="shell partner-grid">
          <div className="partner-copy"><span className="chapter-label">Design partners · Q4 2026</span><h2>Run pikopod against a provider you depend on</h2><p>pikopod is open source and works today. We are looking for a small number of teams willing to use it against a real production dependency while the hosted layer is built.</p>
            <div className="terms"><div><h3>What you get</h3><p>A direct line to the maintainer, influence over provider support, and free hosted access during the program.</p></div><div><h3>What we ask</h3><p>Use it with one real provider, join a short call every two weeks, and tell us when it is wrong.</p></div></div>
          </div><ApplicationForm />
        </div></section>
      </main>

      <footer><div className="shell footer-grid"><div><a className="wordmark" href="#top">pikopod_</a><p>Open source under Apache-2.0.</p></div><div><h3>Product</h3><a href={`${github}#readme`}>Docs</a><a href={github}>GitHub</a><a href={`${github}/releases`}>Releases</a></div><div><h3>Project</h3><a href={`${github}/blob/main/CONTRIBUTING.md`}>Contributing</a><a href={`${github}/security/policy`}>Security policy</a></div></div></footer>
    </div>
  );
}
