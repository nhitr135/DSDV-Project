// components/DataAttribution.js
// Act 6 — Data source credit + tech stack
// Academic data-viz projects are graded on data attribution. This block
// makes provenance, scope, and methodology auditable in one glance.

import { html } from '../lib.js';
import { InfoIcon } from './icons.js';

const ASSETS = [
  'AAPL', 'GOOGL', 'TSLA', 'BTC', 'MSFT', 'AMZN', 'NVDA', 'META',
  'ETH', 'GOLD', 'SPY', 'QQQ', 'TLT', 'VNQ', 'XOM',
];

export function DataAttribution() {
  return html`
    <div class="mt-12 pt-8 border-t border-slate-200">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">

        <!-- Source -->
        <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200">
          <div class="flex items-center gap-2 mb-3">
            <div class="p-1.5 bg-blue-50 rounded-lg">
              <${InfoIcon} className="text-blue-600 w-4 h-4" />
            </div>
            <h4 class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Data Source</h4>
          </div>
          <p class="text-sm font-bold text-slate-800 leading-tight mb-1">Yahoo Finance</p>
          <p class="text-[11px] text-slate-600 leading-relaxed">
            Daily adjusted close prices fetched via the${' '}
            <code class="px-1 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono text-slate-700">yfinance</code>${' '}
            Python library. Returns computed as <span class="font-mono">P_t / P_{t-1} − 1</span>.
          </p>
          <p class="text-[10px] text-slate-400 mt-2 italic">
            Crypto prices (BTC, ETH) from Yahoo's Coin/USD feeds.
          </p>
        </div>

        <!-- Scope -->
        <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200">
          <div class="flex items-center gap-2 mb-3">
            <div class="p-1.5 bg-emerald-50 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <h4 class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Coverage</h4>
          </div>
          <p class="text-sm font-bold text-slate-800 leading-tight mb-1">
            Jan 1, 2018 → Apr 22, 2026
          </p>
          <p class="text-[11px] text-slate-600 leading-relaxed">
            ~8 years · ~2,000 trading days per series · 15 assets across 8 sectors.
          </p>
          <div class="mt-2 flex flex-wrap gap-1">
            ${ASSETS.map(s => html`
              <span key=${s} class="text-[9px] font-mono font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                ${s}
              </span>`)}
          </div>
        </div>

        <!-- Stack -->
        <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200">
          <div class="flex items-center gap-2 mb-3">
            <div class="p-1.5 bg-violet-50 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
            </div>
            <h4 class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Built With</h4>
          </div>
          <p class="text-sm font-bold text-slate-800 leading-tight mb-1">
            React · D3 · htm · Tailwind
          </p>
          <p class="text-[11px] text-slate-600 leading-relaxed">
            Pure client-side rendering, no build step. All correlation, drawdown,
            and stress-test math computed in the browser from raw daily returns.
          </p>
          <p class="text-[10px] text-slate-400 mt-2 italic">
            Source data preprocessed once via Python; all visualizations are reactive to user input.
          </p>
        </div>
      </div>

      <!-- Disclaimer -->
      <p class="mt-5 text-center text-[10px] text-slate-400 max-w-2xl mx-auto leading-relaxed">
        Educational project for a Data Visualization course. Historical performance does not
        predict future results. Stress-test scenarios use real peak-to-trough returns from the
        listed periods, but actual outcomes in future shocks may differ. Not financial advice.
      </p>
    </div>`;
}
