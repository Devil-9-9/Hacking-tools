const SEVERITY = {
  pass: { label: "PASS", border: "border-pass", text: "text-pass" },
  warn: { label: "WARN", border: "border-warn", text: "text-warn" },
  fail: { label: "FAIL", border: "border-fail", text: "text-fail" },
  info: { label: "INFO", border: "border-info", text: "text-info" },
};

export default function CheckRow({ check }) {
  const s = SEVERITY[check.severity] || SEVERITY.info;
  return (
    <li className={`log-row ${s.border} py-3`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-sm sm:text-base text-base-100">{check.title}</span>
        <span className={`font-mono text-xs shrink-0 ${s.text}`}>{s.label}</span>
      </div>
      <p className="text-sm text-base-400 mt-1">{check.summary}</p>
      {check.detail && (
        <p className="text-xs font-mono text-base-500 mt-1.5 break-all">{check.detail}</p>
      )}
    </li>
  );
}
