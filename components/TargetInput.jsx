export default function TargetInput({ value, onChange, onSubmit, loading, error }) {
  function handleSubmit(e) {
    e.preventDefault();
    if (!loading) onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <label htmlFor="target" className="block font-display text-sm text-base-200 mb-2">
        Site to check
      </label>
      <p className="text-xs text-base-400 mb-3 max-w-measure">
        Only run this against a domain you own or have explicit permission to test.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          id="target"
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="my-old-game.com"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-base-800 border border-base-700 rounded-md px-4 py-4 sm:py-3
                     text-base sm:text-sm text-base-100 placeholder-base-500 font-mono
                     focus:border-info focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="bg-info disabled:bg-base-700 disabled:text-base-500 text-base-950
                     font-display font-semibold tracking-tight
                     text-base sm:text-sm rounded-md px-6
                     py-4 sm:py-3 min-h-[52px]
                     active:scale-[0.98] transition-transform
                     disabled:active:scale-100"
        >
          {loading ? "Scanning…" : "Run diagnostics"}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-fail font-mono" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
