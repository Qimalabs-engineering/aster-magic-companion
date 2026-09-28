import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/strategies/api-testing")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "API testing strategies: from mocks to failure rehearsal — pikopod" },
      {
        name: "description",
        content:
          "A practical guide to API testing strategies for teams that depend on third-party APIs. Why mocks fall short, and how spec-derived sandboxes, failure rehearsal, and production replay close the gap.",
      },
      { property: "og:title", content: "API testing strategies: from mocks to failure rehearsal — pikopod" },
      {
        property: "og:description",
        content:
          "Why traditional mocks miss the failures that hurt, and how pikopod's spec-derived sandbox and drift detection give you a stronger API testing strategy.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApiTestingStrategiesPage,
});

function ApiTestingStrategiesPage() {
  return (
    <div className="shell guide-page">
      <header className="guide-header">
        <p className="kicker">Guide</p>
        <h1>API testing strategies: from mocks to failure rehearsal</h1>
        <p className="guide-lede">
          Most API testing strategies stop at mocks and happy-path contract tests. This guide covers
          the full spectrum, where each approach breaks down, and how pikopod's spec-derived sandbox
          and drift detection give you a more robust alternative to traditional mocking.
        </p>
      </header>

      <section className="guide-section">
        <h2>The spectrum of API testing strategies</h2>
        <p>
          Teams that depend on third-party APIs usually combine several of these approaches. Each one
          answers a different question, and each one has a blind spot.
        </p>
        <div className="guide-grid">
          <article className="guide-card">
            <h3>1. Hand-written mocks</h3>
            <p>
              You stub the provider's responses yourself. Fast and simple, but the mock only knows
              what you told it. It returns the success you imagined, never the 503 the provider
              actually sends under load, and it silently drifts out of date when the API changes.
            </p>
          </article>
          <article className="guide-card">
            <h3>2. Recorded fixtures (VCR-style)</h3>
            <p>
              You capture real responses once and replay them. More faithful than hand-written mocks,
              but the recordings freeze a moment in time. They cannot produce failures you never
              recorded, and they go stale the moment the provider ships a change.
            </p>
          </article>
          <article className="guide-card">
            <h3>3. Contract testing</h3>
            <p>
              You verify that requests and responses match an agreed schema. Good at catching shape
              mismatches, but it says nothing about behavior: timeouts, rate limits, retry storms,
              partial failures, and duplicate webhook deliveries all pass a contract check.
            </p>
          </article>
          <article className="guide-card">
            <h3>4. Sandbox environments</h3>
            <p>
              The provider's own test environment. Real behavior, but shared, rate-limited, often
              unable to trigger the failure modes you need to test, and useless in CI where you need
              determinism.
            </p>
          </article>
          <article className="guide-card">
            <h3>5. Failure rehearsal</h3>
            <p>
              You deliberately run your integration against the failures production will eventually
              produce: declines, timeouts, rate-limit backoff, duplicate deliveries. This is the
              layer most strategies skip, and the layer pikopod is built for.
            </p>
          </article>
          <article className="guide-card">
            <h3>6. Production replay</h3>
            <p>
              When production fails anyway, you capture the exact failure and replay it into a local
              sandbox, so the fix is proven against the real incident and kept as a regression test.
            </p>
          </article>
        </div>
      </section>

      <section className="guide-section">
        <h2>Why traditional mocking falls short</h2>
        <p>
          Mocks encode your assumptions about the API, not the API itself. Three failure patterns
          show up again and again:
        </p>
        <ul className="guide-list">
          <li>
            <strong>Assumption drift.</strong> The provider changes a field, a status code, or a
            webhook shape. Your mock still returns the old shape, your tests stay green, and
            production is where you find out.
          </li>
          <li>
            <strong>Happy-path bias.</strong> Mocks return what you wrote down, and people write
            down successes. The retry path, the timeout path, and the duplicate-delivery path never
            get exercised until a real incident exercises them for you.
          </li>
          <li>
            <strong>No shared truth.</strong> Every hand-written mock is a private opinion about the
            API. There is no mechanism that ties it back to the provider's actual specification.
          </li>
        </ul>
      </section>

      <section className="guide-section">
        <h2>A stronger strategy: spec-derived sandboxes</h2>
        <p>
          pikopod builds a deterministic sandbox directly from the provider's OpenAPI spec or docs
          URL. Because the sandbox is derived from the spec rather than hand-authored, it stays
          anchored to the provider's published contract, and it can fail on purpose in the ways the
          spec allows.
        </p>
        <div className="terminal" aria-label="pikopod import example">
          <div className="terminal-bar"><span /><span /><span /></div>
          <pre>{`$ pikopod import examplepay --from https://docs.examplepay.com/openapi.json
sandbox sb_9f2c created from examplepay spec (4 endpoints)

$ pikopod up sb_9f2c
listening on http://localhost:4010  (standing state: ready)`}</pre>
        </div>
        <p>
          Point your integration at the sandbox and rehearse the scenarios that matter, including
          the ones the provider's own sandbox never produces:
        </p>
        <div className="terminal" aria-label="pikopod scenario run example">
          <div className="terminal-bar"><span /><span /><span /></div>
          <pre>{`$ pikopod scenario run declines
PASS  card_declined        14 assertions
PASS  insufficient_funds   11 assertions
PASS  rate_limit_backoff    9 assertions
PASS  retry_storm          12 assertions`}</pre>
        </div>
      </section>

      <section className="guide-section">
        <h2>Drift detection: keep the contract honest</h2>
        <p>
          A spec-derived sandbox also gives you a tripwire. pikopod diffs the provider's published
          spec against the version your integration was built on, and can gate CI on the result.
          When the provider changes something, you find out in a pull request instead of in an
          incident.
        </p>
        <div className="terminal" aria-label="pikopod spec diff example">
          <div className="terminal-bar"><span /><span /><span /></div>
          <pre>{`$ pikopod spec-diff examplepay --fail-on breaking
ERR  spec-diff: POST /v1/charges response removed field "failure_code"
exit 1`}</pre>
        </div>
      </section>

      <section className="guide-section">
        <h2>Close the loop with production replay</h2>
        <p>
          No strategy prevents every failure. When production hits one anyway, pikopod captures the
          incident and replays it into the same sandbox, so you reproduce it on a laptop, fix it,
          and keep the replay as a permanent regression test.
        </p>
        <div className="terminal" aria-label="pikopod reproduce example">
          <div className="terminal-bar"><span /><span /><span /></div>
          <pre>{`$ pikopod incidents
fp_14835fa32dfb  503  POST /v1/charges  2026-09-21T14:03:11Z

$ pikopod scenario reproduce fp_14835fa32dfb
incident written to .pikopod/incidents/fp_14835fa32dfb.json
re-run with: pikopod scenario run fp_14835fa32dfb`}</pre>
        </div>
      </section>

      <section className="guide-section">
        <h2>Putting it together</h2>
        <p>
          A robust API testing strategy layers these approaches: contract checks for shape, a
          spec-derived sandbox for behavior, failure rehearsal for the paths mocks never cover,
          drift detection to catch provider changes early, and production replay to turn every real
          incident into a permanent test. pikopod covers the last four in one loop.
        </p>
        <div className="guide-cta">
          <Link to="/" className="primary-link">See the full loop</Link>
          <a className="outline-link" href="https://docs.pikopod.com">Read the docs</a>
        </div>
      </section>
    </div>
  );
}
