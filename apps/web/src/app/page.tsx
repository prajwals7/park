import { GATES, PASS_CONFIG, formatPaiseToInr } from '@wpd/shared';

export default function HomePage() {
  return (
    <main className="p-8 max-w-4xl mx-auto space-y-6">
      <header className="border-b pb-4">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Walker Pass Desk</h1>
        <p className="text-sm text-slate-500 mt-1">
          Production Park Ticketing & Pass Renewal System
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-lg border shadow-sm">
          <div className="text-sm font-medium text-slate-500">Standard Pass Rate</div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {formatPaiseToInr(PASS_CONFIG.PRICE_PAISE)}
          </div>
          <p className="text-xs text-slate-400 mt-1">30 days validity</p>
        </div>

        <div className="p-4 bg-white rounded-lg border shadow-sm">
          <div className="text-sm font-medium text-slate-500">Active Gates</div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{GATES.join(', ')}</div>
          <p className="text-xs text-slate-400 mt-1">G2, GS, G9 entrypoints</p>
        </div>

        <div className="p-4 bg-white rounded-lg border shadow-sm">
          <div className="text-sm font-medium text-slate-500">System Timezone</div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{PASS_CONFIG.TIMEZONE}</div>
          <p className="text-xs text-slate-400 mt-1">UTC storage, IST display</p>
        </div>
      </div>
    </main>
  );
}
