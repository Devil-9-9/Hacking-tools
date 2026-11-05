import { useState } from "react";
import TargetInput from "../components/TargetInput";
import ResultsReport from "../components/ResultsReport";
import useIsMobile from "../hooks/useIsMobile";

const TABS = [
  { id: "scan", label: "Scan" },
  { id: "about", label: "About" },
];

async function fetchWithRetry(url, opts, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, opts);
      if (res.status >= 500 && i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr || new Error("Request failed.");
}

export default function Home() {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState("scan");
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function runScan() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetchWithRetry("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Scan failed.");
      } else {
        setResult(data);
      }
    } catch (err) {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const nav = (
    <nav
      className={
        isMobile
          ? "fixed bottom-0 inset-x-0 z-20 bg-base-900 border-t border-base-800 flex pb-[env(safe-area-inset-bottom,0px)]"
          : "hidden md:flex md:flex-col md:w-48 md:shrink-0 md:border-r md:border-base-800 md:pr-4 md:pt-8"
      }
    >
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={
            isMobile
              ? `flex-1 py-3 text-sm font-display ${
                  tab === t.id ? "text-info" : "text-base-500"
                }`
              : `text-left px-3 py-2.5 rounded-md text-sm font-display mb-1 ${
                  tab === t.id ? "bg-base-800 text-info" : "text-base-400 hover:text-base-100"
                }`
          }
        >
          {t.label}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-base-950 text-base-100">
      <div
        className="max-w-5xl mx-auto px-4 sm:px-6 md:flex md:gap-8"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        {!isMobile && nav}

        <main className="flex-1 py-8 pb-24 md:pb-16">
          <header className="mb-8">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
              Site diagnostics scanner
            </h1>
            <p className="text-base-400 text-sm mt-2 max-w-measure">
              Non-intrusive checks against your own site: response headers, TLS certificate,
              commonly-exposed paths, and DNS security records.
            </p>
          </header>

          {tab === "scan" && (
            <section>
              <TargetInput
                value={target}
                onChange={setTarget}
                onSubmit={runScan}
                loading={loading}
                error={error}
              />
              {loading && (
                <div className="mt-6 h-1 bg-base-800 rounded-full overflow-hidden relative">
                  <div className="scan-sweep absolute inset-y-0 w-1/3 bg-info/70 rounded-full" />
                </div>
              )}
              <ResultsReport result={result} />
            </section>
          )}

          {tab === "about" && (
            <section className="max-w-measure text-sm text-base-300 space-y-4">
              <p>
                This tool runs a handful of read-only checks that any browser performs implicitly
                when it visits a page: it reads the response headers, inspects the TLS
                certificate, requests a short list of paths that are commonly left exposed by
                accident (like <code className="font-mono text-base-200">/.env</code> or{" "}
                <code className="font-mono text-base-200">/.git/config</code>), and looks up a
                few DNS security records.
              </p>
              <p>
                It does not attempt to log in, exploit anything, brute-force credentials, or scan
                ports. Only run it against sites you own or are authorized to test.
              </p>
              <p>
                Install this as an app: on phone, open this page in your browser and choose
                &quot;Add to Home Screen&quot;. On desktop Chrome, use the install icon in the
                address bar.
              </p>
            </section>
          )}
        </main>
      </div>

      {isMobile && nav}
    </div>
  );
}
