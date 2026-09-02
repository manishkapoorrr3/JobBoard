export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex flex-col items-center justify-between gap-3 text-sm text-slate-500 sm:flex-row">
          <p className="font-semibold text-slate-700">NCR Walk-in — BPO jobs in Delhi NCR</p>
          <nav className="flex flex-wrap gap-4">
            <a href="/pricing" className="hover:text-slate-900">Pricing</a>
            <a href="/privacy" className="hover:text-slate-900">Privacy</a>
            <a href="/terms" className="hover:text-slate-900">Terms</a>
          </nav>
        </div>
        <p className="mt-3 text-center text-xs text-slate-400">
          Companies pay to post. Fake walk-ins get removed. Report any listing that looks wrong.
        </p>
      </div>
    </footer>
  );
}
