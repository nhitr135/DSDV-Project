// components/CorrelationBarChart.js
import { html, useMemo, useState } from '../lib.js';
import { cn, calculateCorrelation, getCorrelationInsight } from '../utils.js';
import { BarChart2Icon, LightbulbIcon } from './icons.js';

export function CorrelationBarChart({ assets }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const pairs = useMemo(() => {
    const out = [];
    for (let i = 0; i < assets.length; i++)
      for (let j = i + 1; j < assets.length; j++) {
        const r = calculateCorrelation(assets[i].returns, assets[j].returns);
        out.push({
          label:   `${assets[i].symbol} / ${assets[j].symbol}`,
          r,
          colA:    assets[i].color,
          colB:    assets[j].color,
          insight: getCorrelationInsight(assets[i].symbol, assets[j].symbol, r),
        });
      }
    return out.sort((a, b) => b.r - a.r);
  }, [assets]);

  const barColor = r => {
    if (r > 0.7)  return { bar: '#ef4444', bg: 'bg-red-50',    text: 'text-red-700',    label: 'HIGH RISK' };
    if (r > 0.4)  return { bar: '#f59e0b', bg: 'bg-amber-50',  text: 'text-amber-700',  label: 'MODERATE'  };
    if (r > 0.1)  return { bar: '#60a5fa', bg: 'bg-blue-50',   text: 'text-blue-700',   label: 'LOW'       };
    if (r > -0.1) return { bar: '#94a3b8', bg: 'bg-slate-50',  text: 'text-slate-500',  label: 'NONE'      };
    return               { bar: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'HEDGE'    };
  };

  if (pairs.length === 0) return null;

  const high  = pairs.filter(p => p.r > 0.7).length;
  // Hedge boundary uses `<=` to match `barColor()` which paints r ≤ -0.1 as
  // HEDGE (the inverse condition `r > -0.1` is non-hedge). Previously this
  // line used strict `<` which excluded exactly r = -0.1 from the hedge count
  // while still painting it green — a UI/text inconsistency.
  const hedge = pairs.filter(p => p.r <= -0.1).length;
  const summary = high > pairs.length * 0.5
    ? `${high} of ${pairs.length} pairs are highly correlated — consider adding assets from different sectors.`
    : hedge > 0
    ? `You have ${hedge} natural hedge pair${hedge > 1 ? 's' : ''} — these assets protect each other during market downturns.`
    : `Your pair correlations are moderate. Adding uncorrelated assets (bonds, gold) could reduce overall risk.`;

  return html`
    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div class="flex items-center gap-2 mb-5">
        <div class="p-1.5 bg-sky-50 rounded-lg"><${BarChart2Icon} className="text-sky-500 w-4 h-4" /></div>
        <div>
          <h2 class="text-sm font-bold uppercase tracking-tight">Correlation Ranking</h2>
          <p class="text-[10px] text-slate-400 font-medium">All asset pairs ranked — hover for insight</p>
        </div>
        <div class="ml-auto flex items-center gap-3 flex-wrap justify-end">
          ${[['#ef4444','High Risk'],['#f59e0b','Moderate'],['#60a5fa','Low'],['#10b981','Hedge']].map(([c, l]) => html`
            <div key=${l} class="flex items-center gap-1">
              <div class="w-2.5 h-2.5 rounded-sm" style=${{ backgroundColor: c }} />
              <span class="text-[9px] font-bold text-slate-500">${l}</span>
            </div>`)}
        </div>
      </div>

      <div class="space-y-2">
        ${pairs.map((p, i) => {
          const { bar, bg, text, label } = barColor(p.r);
          const pct       = Math.abs(p.r) * 100;
          const isHovered = hoveredIdx === i;
          return html`
            <div key=${p.label}
              class=${cn('rounded-xl border transition-all cursor-pointer', isHovered ? bg + ' border-slate-300 shadow-sm' : 'bg-slate-50 border-transparent hover:border-slate-200')}
              onMouseEnter=${() => setHoveredIdx(i)} onMouseLeave=${() => setHoveredIdx(null)}>
              <div class="flex items-center gap-3 p-2.5">
                <div class="flex -space-x-1.5 shrink-0">
                  <div class="w-4 h-4 rounded-full border-2 border-white shadow-sm" style=${{ backgroundColor: p.colA }} />
                  <div class="w-4 h-4 rounded-full border-2 border-white shadow-sm" style=${{ backgroundColor: p.colB }} />
                </div>
                <span class="text-xs font-bold text-slate-700 w-24 shrink-0">${p.label}</span>
                <div class="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all duration-500"
                    style=${{ width: `${pct}%`, backgroundColor: bar }} />
                </div>
                <div class="shrink-0 text-right w-16">
                  <span class="text-xs font-black" style=${{ color: bar }}>${p.r >= 0 ? '+' : ''}${(p.r * 100).toFixed(0)}%</span>
                  <div class=${cn('text-[8px] font-black uppercase tracking-wide', text)}>${label}</div>
                </div>
              </div>
              ${isHovered && html`
                <div class=${cn('px-3 pb-2.5 text-[10px] font-medium leading-relaxed', text)}>
                  → ${p.insight}
                </div>`}
            </div>`;
        })}
      </div>

      <div class="mt-4 pt-4 border-t border-slate-100">
        <div class="flex items-start gap-2 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
          <${LightbulbIcon} className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" />
          <p class="text-[10px] text-indigo-700 font-medium leading-relaxed">${summary}</p>
        </div>
      </div>
    </div>`;
}
