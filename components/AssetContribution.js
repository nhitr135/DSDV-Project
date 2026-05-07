// components/AssetContribution.js
// Risk contribution per asset using component-VaR (Euler decomposition).
// Hedges show NEGATIVE contributions — they reduce portfolio variance —
// rendered as green bars going LEFT from a center axis.
//
// Two layouts:
//   - default: full panel with header, axis legend, and prose insights
//   - compact: trimmed sidebar variant — bars only + a 1-line headline
//
// Use compact=true when rendering inside the Act 5 sidebar; use the default
// when the component owns a full row in the main column.

import { html, useMemo, useState, useEffect } from '../lib.js';
import { computeRiskContributions, calculateStandardDeviation } from '../utils.js';
import { PieChartIcon, BarChart2Icon, ShieldAlertIcon } from './icons.js';

/**
 * Diverging bar — renders left (green hedge) or right (red risk-add) from
 * a center axis. The track shows ±maxAbsPct so each bar is self-comparable.
 */
function DivergingBar({ item, delay, scale }) {
  const [animPct, setAnimPct] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimPct(item.pct), 50 + delay * 1000);
    return () => clearTimeout(t);
  }, [item.pct, delay]);

  const isHedge = item.pct < 0;
  const fillColor = isHedge ? '#10b981' : '#ef4444';
  // Bar width as fraction of half-track (50% of full row)
  const widthPct = Math.min(100, (Math.abs(animPct) / scale) * 100);

  return html`
    <div class="animate-slide-in" style=${{ animationDelay: `${delay}s` }}>
      <div class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-2">
          <div class="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shadow-sm"
            style=${{ backgroundColor: item.asset.color }}>${item.asset.symbol[0]}</div>
          <span class="text-xs font-bold text-slate-700">${item.asset.symbol}</span>
          ${isHedge && html`
            <span class="text-[8px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              hedge
            </span>`}
        </div>
        <div class="flex items-center gap-3">
          <span class="text-[10px] text-slate-400">vol ${item.volatility.toFixed(1)}%</span>
          <span class=${`text-xs font-black w-12 text-right ${isHedge ? 'text-emerald-600' : 'text-slate-800'}`}>
            ${item.pct >= 0 ? '+' : ''}${item.pct.toFixed(1)}%
          </span>
        </div>
      </div>
      <!-- Diverging track: center axis at 50%, left=hedge, right=risk-add -->
      <div class="relative h-2 bg-slate-100 rounded-full overflow-hidden">
        <!-- Center axis -->
        <div class="absolute inset-y-0 left-1/2 w-px bg-slate-300"></div>
        <!-- Bar -->
        <div class="absolute inset-y-0 rounded-full transition-all duration-700"
          style=${isHedge
            ? { right: '50%', width: `${widthPct / 2}%`, backgroundColor: fillColor }
            : { left: '50%',  width: `${widthPct / 2}%`, backgroundColor: fillColor }} />
      </div>
    </div>`;
}

export function AssetContribution({ assets, compact = false }) {
  const items = useMemo(() => {
    if (assets.length === 0) return [];
    const totalW = assets.reduce((s, a) => s + a.weight, 0);
    const norm = totalW === 0
      ? assets.map(() => 1 / assets.length)
      : assets.map(a => a.weight / totalW);

    const contribs = computeRiskContributions(assets, norm);
    return assets.map((asset, i) => ({
      asset,
      contribution: contribs[i].contribution,
      pct:          contribs[i].pct,
      volatility:   calculateStandardDeviation(asset.returns) * 100,
    })).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)); // by IMPACT magnitude
  }, [assets]);

  if (items.length === 0) return null;

  // Use a symmetric scale so bars are visually comparable.
  // Always at least 60 so a single 35% asset doesn't span the entire half-track.
  const maxAbs = Math.max(60, ...items.map(i => Math.abs(i.pct)));

  const risks = items.filter(i => i.pct >= 0);
  const hedges = items.filter(i => i.pct < 0);
  const top = risks[0];
  const top2pct = risks.slice(0, 2).reduce((s, c) => s + c.pct, 0);
  const totalHedge = hedges.reduce((s, c) => s + c.pct, 0); // negative number

  // Compact: bars + 1-line headline. No axis legend, no prose insights.
  // Designed for the Act 5 sidebar.
  if (compact) {
    return html`
      <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <!-- Tiny axis hint -->
        <div class="flex items-center justify-between mb-2 px-1 text-[8px] font-bold uppercase tracking-wide">
          <span class="text-emerald-700">← reduces</span>
          <span class="text-slate-400">0%</span>
          <span class="text-red-700">adds →</span>
        </div>
        <div class="space-y-2">
          ${items.map((item, i) => html`
            <${DivergingBar} key=${item.asset.id || item.asset.symbol} item=${item} delay=${i * 0.05} scale=${maxAbs} />`)}
        </div>
        <!-- Single-line takeaway (replaces the two prose panels) -->
        ${top && html`
          <p class="text-[10px] text-slate-600 mt-3 pt-2 border-t border-slate-100 leading-tight">
            <span class="font-black text-orange-600">${top.asset.symbol}</span> drives
            <span class="font-black">${top.pct.toFixed(0)}%</span> of your risk${
              top2pct > 70
                ? `${'. '}Top 2 = ${top2pct.toFixed(0)}%.`
                : '. Risk is well-distributed.'
            }
          </p>`}
      </div>`;
  }

  return html`
    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div class="flex items-center gap-2 mb-5">
        <div class="p-1.5 bg-orange-50 rounded-lg"><${PieChartIcon} className="text-orange-500 w-4 h-4" /></div>
        <div>
          <h2 class="text-sm font-bold uppercase tracking-tight">Risk Contribution</h2>
          <p class="text-[10px] text-slate-400 font-medium">Each asset's signed share of portfolio variance · sums to 100%</p>
        </div>
      </div>

      <!-- Axis legend -->
      <div class="flex items-center justify-between mb-2 px-1">
        <div class="flex items-center gap-1.5">
          <div class="w-2 h-2 rounded-sm bg-emerald-500"></div>
          <span class="text-[9px] font-bold text-emerald-700 uppercase tracking-wide">← Reduces risk</span>
        </div>
        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wide">center = 0%</span>
        <div class="flex items-center gap-1.5">
          <span class="text-[9px] font-bold text-red-700 uppercase tracking-wide">Adds risk →</span>
          <div class="w-2 h-2 rounded-sm bg-red-500"></div>
        </div>
      </div>

      <div class="space-y-3">
        ${items.map((item, i) => html`
          <${DivergingBar} key=${item.asset.id || item.asset.symbol} item=${item} delay=${i * 0.05} scale=${maxAbs} />`)}
      </div>

      <!-- Insights — separate panels for risk drivers and hedges -->
      <div class="mt-5 pt-4 border-t border-slate-100 space-y-2">
        ${top && html`
          <div class="flex items-start gap-2 p-3 bg-orange-50 rounded-xl border border-orange-100">
            <${BarChart2Icon} className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
            <p class="text-[10px] text-orange-700 font-medium leading-relaxed">
              <span class="font-black">${top.asset.symbol}</span> is your biggest risk driver at
              <span class="font-black"> ${top.pct.toFixed(1)}%</span>.${' '}
              ${top2pct > 70
                ? `Top 2 risk drivers (${risks.slice(0, 2).map(c => c.asset.symbol).join(' & ')}) account for ${top2pct.toFixed(0)}% of portfolio risk.`
                : 'Risk is relatively distributed across your portfolio.'}
            </p>
          </div>`}
        ${hedges.length > 0 && html`
          <div class="flex items-start gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <${ShieldAlertIcon} className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
            <p class="text-[10px] text-emerald-700 font-medium leading-relaxed">
              <span class="font-black">${hedges.map(c => c.asset.symbol).join(' & ')}</span>${' '}
              ${hedges.length > 1 ? 'are working as hedges — together they reduce' : 'is working as a hedge — it reduces'}
              portfolio variance by <span class="font-black">${Math.abs(totalHedge).toFixed(1)}%</span>.
              Negative covariance with the rest of your mix is exactly what diversification looks like in math.
            </p>
          </div>`}
      </div>
    </div>`;
}
