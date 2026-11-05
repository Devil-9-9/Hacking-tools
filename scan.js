import tls from "node:tls";
import { promises as dns } from "node:dns";

export const config = {
  api: { bodyParser: true },
  maxDuration: 30,
};

const FETCH_TIMEOUT_MS = 6000;
const EXPOSED_PATHS = [
  "/.env",
  "/.git/config",
  "/.git/HEAD",
  "/wp-config.php.bak",
  "/config.json",
  "/.DS_Store",
  "/backup.zip",
  "/.well-known/security.txt",
  "/server-status",
  "/phpinfo.php",
];

function row(id, title, severity, summary, detail = "") {
  return { id, title, severity, summary, detail };
}

async function timedFetch(url, opts = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeoutMs || FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "site-diagnostics-scanner/1.0 (owner-initiated check)" },
      ...opts,
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

function normalizeTarget(raw) {
  let input = (raw || "").trim();
  if (!input) return null;
  if (!/^https?:\/\//i.test(input)) input = `https://${input}`;
  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  // block scanning private/loopback/link-local network ranges from a public function
  const host = url.hostname.toLowerCase();
  const blocked = [
    /^localhost$/,
    /^127\./,
    /^0\.0\.0\.0$/,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,
    /^169\.254\./,
    /^\[?::1\]?$/,
  ];
  if (blocked.some((re) => re.test(host))) return null;
  return url;
}

async function checkHeaders(url) {
  const checks = [];
  let res;
  try {
    res = await timedFetch(url.toString());
  } catch (err) {
    checks.push(
      row(
        "reachability",
        "Reachability",
        "fail",
        `Could not reach the target (${err.name === "AbortError" ? "timed out" : err.message}).`
      )
    );
    return { checks, res: null };
  }

  checks.push(
    row(
      "reachability",
      "Reachability",
      "pass",
      `Responded with HTTP ${res.status} ${res.statusText || ""}.`.trim()
    )
  );

  const h = res.headers;
  const get = (name) => h.get(name);

  // HSTS
  const hsts = get("strict-transport-security");
  checks.push(
    hsts
      ? row("hsts", "Strict-Transport-Security", "pass", "HSTS header present.", hsts)
      : row(
          "hsts",
          "Strict-Transport-Security",
          "warn",
          "No HSTS header. Browsers won't be forced to use HTTPS on repeat visits.",
          "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains"
        )
  );

  // CSP
  const csp = get("content-security-policy");
  checks.push(
    csp
      ? row("csp", "Content-Security-Policy", "pass", "A CSP is set.", csp)
      : row(
          "csp",
          "Content-Security-Policy",
          "warn",
          "No Content-Security-Policy header. Increases exposure to injected-script attacks.",
          "Even a basic default-src 'self' policy is a meaningful improvement."
        )
  );

  // X-Frame-Options / frame-ancestors
  const xfo = get("x-frame-options");
  const hasFrameAncestors = csp && /frame-ancestors/i.test(csp);
  checks.push(
    xfo || hasFrameAncestors
      ? row("clickjacking", "Clickjacking protection", "pass", xfo ? `X-Frame-Options: ${xfo}` : "frame-ancestors set via CSP.")
      : row(
          "clickjacking",
          "Clickjacking protection",
          "warn",
          "No X-Frame-Options or CSP frame-ancestors directive.",
          "Add: X-Frame-Options: DENY (or SAMEORIGIN) or a CSP frame-ancestors directive."
        )
  );

  // X-Content-Type-Options
  const xcto = get("x-content-type-options");
  checks.push(
    xcto && xcto.toLowerCase() === "nosniff"
      ? row("nosniff", "X-Content-Type-Options", "pass", "nosniff is set.")
      : row(
          "nosniff",
          "X-Content-Type-Options",
          "warn",
          "Missing nosniff header, allows MIME-type sniffing in some browsers.",
          "Add: X-Content-Type-Options: nosniff"
        )
  );

  // Referrer-Policy
  const rp = get("referrer-policy");
  checks.push(
    rp
      ? row("referrer", "Referrer-Policy", "pass", `Set to "${rp}".`)
      : row("referrer", "Referrer-Policy", "info", "No Referrer-Policy set; browser defaults apply.")
  );

  // Server / X-Powered-By disclosure
  const server = get("server");
  const poweredBy = get("x-powered-by");
  const disclosed = [server, poweredBy].filter(Boolean).join(", ");
  checks.push(
    disclosed
      ? row(
          "fingerprint",
          "Server fingerprinting",
          "info",
          `Response discloses: ${disclosed}. Not dangerous alone, but it narrows down attack research for anyone probing the site.`
        )
      : row("fingerprint", "Server fingerprinting", "pass", "No Server/X-Powered-By header leaking stack details.")
  );

  // Cookies
  const setCookie = h.get("set-cookie");
  if (setCookie) {
    const missing = [];
    if (!/secure/i.test(setCookie)) missing.push("Secure");
    if (!/httponly/i.test(setCookie)) missing.push("HttpOnly");
    if (!/samesite/i.test(setCookie)) missing.push("SameSite");
    checks.push(
      missing.length
        ? row(
            "cookies",
            "Cookie flags",
            "warn",
            `Cookie set without: ${missing.join(", ")}.`,
            "Missing flags make cookies more exposed to theft via XSS or cross-site requests."
          )
        : row("cookies", "Cookie flags", "pass", "Cookies set with Secure, HttpOnly, and SameSite.")
    );
  }

  return { checks, res };
}

async function checkTls(url) {
  if (url.protocol !== "https:") {
    return [row("tls", "TLS certificate", "warn", "Site is not served over HTTPS; skipping certificate check.")];
  }
  return new Promise((resolve) => {
    const port = url.port ? Number(url.port) : 443;
    const socket = tls.connect(
      { host: url.hostname, port, servername: url.hostname, timeout: 6000 },
      () => {
        const cert = socket.getCertificate ? socket.getCertificate() : socket.getPeerCertificate();
        const result = [];
        if (!cert || Object.keys(cert).length === 0) {
          result.push(row("tls", "TLS certificate", "warn", "Could not read certificate details."));
        } else {
          const validTo = new Date(cert.valid_to);
          const daysLeft = Math.round((validTo.getTime() - Date.now()) / 86400000);
          if (daysLeft < 0) {
            result.push(row("tls", "TLS certificate", "fail", `Certificate expired ${Math.abs(daysLeft)} day(s) ago.`));
          } else if (daysLeft < 14) {
            result.push(row("tls", "TLS certificate", "fail", `Certificate expires in ${daysLeft} day(s).`));
          } else if (daysLeft < 30) {
            result.push(row("tls", "TLS certificate", "warn", `Certificate expires in ${daysLeft} day(s).`));
          } else {
            result.push(row("tls", "TLS certificate", "pass", `Valid, expires in ${daysLeft} days (${cert.valid_to}).`));
          }
          result.push(row("tls-issuer", "Certificate issuer", "info", cert.issuer?.O || cert.issuer?.CN || "Unknown issuer"));
          result.push(
            row(
              "tls-protocol",
              "TLS protocol",
              ["TLSv1.3", "TLSv1.2"].includes(socket.getProtocol())
                ? "pass"
                : "warn",
              `Negotiated ${socket.getProtocol()}.`
            )
          );
        }
        socket.end();
        resolve(result);
      }
    );
    socket.on("error", (err) => {
      resolve([row("tls", "TLS certificate", "fail", `TLS connection failed: ${err.message}`)]);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve([row("tls", "TLS certificate", "warn", "TLS connection timed out.")]);
    });
  });
}

async function checkExposedPaths(url) {
  const results = await Promise.allSettled(
    EXPOSED_PATHS.map(async (p) => {
      try {
        const res = await timedFetch(new URL(p, url).toString(), {
          method: "GET",
          redirect: "manual",
          timeoutMs: 4000,
        });
        return { path: p, status: res.status };
      } catch {
        return { path: p, status: null };
      }
    })
  );

  const exposed = results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((r) => r && r.status && r.status >= 200 && r.status < 300);

  if (exposed.length === 0) {
    return [
      row(
        "exposed-paths",
        "Exposed sensitive paths",
        "pass",
        `None of ${EXPOSED_PATHS.length} commonly-abused paths returned a 2xx response.`
      ),
    ];
  }
  return [
    row(
      "exposed-paths",
      "Exposed sensitive paths",
      "fail",
      `${exposed.length} path(s) are publicly reachable: ${exposed.map((e) => e.path).join(", ")}`,
      "These paths often leak credentials, source control history, or backups. Remove or block public access to them."
    ),
  ];
}

async function checkDns(hostname) {
  const checks = [];
  try {
    const txt = await dns.resolveTxt(hostname);
    const flat = txt.map((t) => t.join(""));
    const spf = flat.find((t) => t.toLowerCase().startsWith("v=spf1"));
    checks.push(
      spf
        ? row("spf", "SPF record", "pass", spf)
        : row("spf", "SPF record", "info", "No SPF record found on the apex domain (only relevant if this domain sends email).")
    );
  } catch {
    checks.push(row("spf", "SPF record", "info", "Could not resolve TXT records."));
  }

  try {
    const dmarc = await dns.resolveTxt(`_dmarc.${hostname}`);
    const flat = dmarc.map((t) => t.join(""));
    checks.push(row("dmarc", "DMARC record", "pass", flat[0]));
  } catch {
    checks.push(row("dmarc", "DMARC record", "info", "No DMARC record found (only relevant if this domain sends email)."));
  }

  try {
    const caa = await dns.resolveCaa(hostname);
    checks.push(
      caa && caa.length
        ? row("caa", "CAA record", "pass", `Restricts certificate issuance to: ${caa.map((c) => c.value).join(", ")}`)
        : row("caa", "CAA record", "info", "No CAA record; any CA can issue certificates for this domain.")
    );
  } catch {
    checks.push(row("caa", "CAA record", "info", "No CAA record found."));
  }

  return checks;
}

function scoreOf(checks) {
  const weights = { pass: 0, info: 0, warn: 1, fail: 3 };
  const max = checks.length * 3 || 1;
  const penalty = checks.reduce((sum, c) => sum + (weights[c.severity] || 0), 0);
  return Math.max(0, Math.round(100 - (penalty / max) * 100));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }

  const target = normalizeTarget(req.body?.target);
  if (!target) {
    return res.status(400).json({
      error:
        "Enter a valid public domain (e.g. my-old-game.com). Private, loopback, and local-network addresses are not scanned by this endpoint.",
    });
  }

  const isMobileUA = /mobile|android|iphone/i.test(req.headers["user-agent"] || "");

  const { checks: headerChecks } = await checkHeaders(target);
  const [tlsChecks, pathChecks, dnsChecks] = await Promise.all([
    checkTls(target),
    checkExposedPaths(target),
    checkDns(target.hostname),
  ]);

  let checks = [...headerChecks, ...tlsChecks, ...pathChecks, ...dnsChecks];

  // reduce payload for mobile clients: drop the lowest-value "info" rows beyond a cap
  if (isMobileUA) {
    const infoBudget = 4;
    let infoSeen = 0;
    checks = checks.filter((c) => {
      if (c.severity !== "info") return true;
      infoSeen += 1;
      return infoSeen <= infoBudget;
    });
  }

  return res.status(200).json({
    target: target.toString(),
    hostname: target.hostname,
    timestamp: new Date().toISOString(),
    score: scoreOf(checks),
    checks,
  });
}
