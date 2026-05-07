// components/DiversificationScore.js
//
// Renders a 0-100 diversification score with a gauge needle + grade + plain-
// English insights about correlated/hedging pairs.
//
// Two layouts:
//   - default: 2-column (gauge left, insights right) — full-width main column
//   - compact: vertical stack — sidebar use, half the height
//
// The `compact` flag is the only API addition; everything else stays identical.

import { html, useMemo } from '../lib.js';
import { cn, calculateCorrelation, computeDiversificationScore } from '../utils.js';
import { AlertTriangleIcon, ShieldAlertIcon } from './icons.js';

export function DiversificationScore({ assets, compact = false }) {
  const score = useMemo(() => computeDiversificationScore(assets), [assets]);

  const pairs = useMemo(() => {
    const out = [];
    for (let i = 0; i < assets.length; i++)
      for (let j = i + 1; j < assets.length; j++) {
        const r = calculateCorrelation(assets[i].returns, assets[j].returns);
        out.push({ a: assets[i].symbol, b: assets[j].symbol, r, colA: assets[i].color, colB: assets[j].color });
      }
    return out.sort((x, y) => y.r - x.r);
  }, [assets]);

  let grade, gradeColor, gradeBg, msg;
  if      (score >= 75) { grade = 'A'; gradeColor = 'text-emerald-600'; gradeBg = 'bg-emerald-50 border-emerald-200'; msg = 'Excellent diversification — your assets move mostly independently.'; }
  else if (score >= 55) { grade = 'B'; gradeColor = 'text-blue-600';    gradeBg = 'bg-blue-50 border-blue-200';       msg = 'Good diversification with some correlated pairs to watch.'; }
  else if (score >= 35) { grade = 'C'; gradeColor = 'text-amber-600';   gradeBg = 'bg-amber-50 border-amber-200';     msg = 'Moderate — several assets tend to move together under stress.'; }
  else                  { grade = 'D'; gradeColor = 'text-red-600';     gradeBg = 'bg-red-50 border-red-200';         msg = 'Poor diversification — most assets are highly correlated.'; }

  const danger = pairs.filter(p => p.r > 0.7);
  const hedge  = pairs.filter(p => p.r < -0.3);

  const gaugeArc = (pct) => {
    const a     = Math.PI * (1 - pct);
    const r     = 52;
    const cx    = 80, cy = 68;
    const startA = Math.PI;
    const x1 = cx + r * Math.cos(startA), y1 = cy + r * Math.sin(startA);
    const x2 = cx + r * Math.cos(a),      y2 = cy + r * Math.sin(a);
    const large = pct > 0.5 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  const needleA = Math.PI * (1 - score / 100);
  const cx = 80, cy = 68;
  const needleR = 44;

  // Compact: gauge + grade + insights stacked vertically in a single
  // narrow card. Designed for the Act 5 sidebar where horizontal space
  // is ~280-320px. Hides redundant chrome (sub-title, big icon block).
  if (compact) {
    return html`
      <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div class="flex items-center gap-3 mb-2">
          <svg viewBox="0 0 160 90" width="120" height="68" class="shrink-0">
            <path d=${gaugeArc(1)}    fill="none" stroke="#e2e8f0" stroke-width="10" stroke-linecap="round" />
            <path d=${gaugeArc(0.25)} fill="none" stroke="#fca5a5" stroke-width="10" stroke-linecap="round" />
            <path d=${gaugeArc(0.50)} fill="none" stroke="#fcd34d" stroke-width="10" stroke-linecap="round" />
            <path d=${gaugeArc(0.75)} fill="none" stroke="#6ee7b7" stroke-width="10" stroke-linecap="round" />
            <path d=${gaugeArc(1.00)} fill="none" stroke="#34d399" stroke-width="10" stroke-linecap="round" />
            <path d=${gaugeArc(score / 100)} fill="none"
              stroke=${score >= 75 ? '#10b981' : score >= 55 ? '#3b82f6' : score >= 35 ? '#f59e0b' : '#ef4444'}
              stroke-width="10" stroke-linecap="round" opacity="0.9" />
            <line x1=${cx} y1=${cy}
              x2=${cx + needleR * Math.cos(needleA)}
              y2=${cy + needleR * Math.sin(needleA)}
              stroke="#1e293b" stroke-width="2.5" stroke-linecap="round" />
            <circle cx=${cx} cy=${cy} r="4" fill="#1e293b" />
            <text x=${cx} y=${cy - 14} text-anchor="middle" font-size="22" font-weight="900" fill="#1e293b">${score}</text>
            <text x=${cx} y=${cy - 3}  text-anchor="middle" font-size="8"  font-weight="700" fill="#64748b">/ 100</text>
          </svg>
          <div class="flex-1 min-w-0">
            <div class=${cn('inline-block px-2.5 py-0.5 rounded-lg border', gradeBg)}>
              <span class=${cn('text-base font-black', gradeColor)}>Grade ${grade}</span>
            </div>
            <p class="text-[10px] text-slate-600 mt-1.5 leading-tight">${msg}</p>
          </div>
        </div>
        <!-- Compact pair summary: only show counts, not individual pairs -->
        ${(danger.length > 0 || hedge.length > 0) && html`
          <div class="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-slate-100">
            ${danger.length > 0 && html`
              <div class="flex items-center gap-1 text-[10px] text-red-600 font-bold">
                <${AlertTriangleIcon} className="w-3 h-3 shrink-0" />
                <span class="truncate">${danger.length} same-bet pair${danger.length > 1 ? 's' : ''}</span>
              </div>`}
            ${hedge.length > 0 && html`
              <div class="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                <${ShieldAlertIcon} className="w-3 h-3 shrink-0" />
                <span class="truncate">${hedge.length} counter pair${hedge.length > 1 ? 's' : ''}</span>
              </div>`}
          </div>`}
      </div>`;
  }

  // Default (full): 2-col layout for main content area
  return html`
    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div class="flex items-center gap-2 mb-5">
        <div class="p-1.5 bg-indigo-50 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>
          </svg>
        </div>
        <div>
          <h2 class="text-sm font-bold uppercase tracking-tight">Diversification Score</h2>
          <p class="text-[10px] text-slate-400 font-medium">How well your assets offset each other's risk</p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
        <div class="flex flex-col items-center">
          <svg viewBox="0 0 160 90" width="180" height="100">
            <path d=${gaugeArc(1)}    fill="none" stroke="#e2e8f0" stroke-width="10" stroke-linecap="round" />
            <path d=${gaugeArc(0.25)} fill="none" stroke="#fca5a5" stroke-width="10" stroke-linecap="round" />
            <path d=${gaugeArc(0.50)} fill="none" stroke="#fcd34d" stroke-width="10" stroke-linecap="round" />
            <path d=${gaugeArc(0.75)} fill="none" stroke="#6ee7b7" stroke-width="10" stroke-linecap="round" />
            <path d=${gaugeArc(1.00)} fill="none" stroke="#34d399" stroke-width="10" stroke-linecap="round" />
            <path d=${gaugeArc(score / 100)} fill="none"
              stroke=${score >= 75 ? '#10b981' : score >= 55 ? '#3b82f6' : score >= 35 ? '#f59e0b' : '#ef4444'}
              stroke-width="10" stroke-linecap="round" opacity="0.9" />
            <line x1=${cx} y1=${cy}
              x2=${cx + needleR * Math.cos(needleA)}
              y2=${cy + needleR * Math.sin(needleA)}
              stroke="#1e293b" stroke-width="2.5" stroke-linecap="round" />
            <circle cx=${cx} cy=${cy} r="4" fill="#1e293b" />
            <text x="22" y="82" font-size="8" fill="#ef4444" font-weight="700">Poor</text>
            <text x="124" y="82" font-size="8" fill="#10b981" font-weight="700">Great</text>
            <text x=${cx} y=${cy - 14} text-anchor="middle" font-size="22" font-weight="900" fill="#1e293b">${score}</text>
            <text x=${cx} y=${cy - 3}  text-anchor="middle" font-size="8"  font-weight="700" fill="#64748b">/ 100</text>
          </svg>
          <div class=${cn('mt-1 px-4 py-1.5 rounded-xl border text-center', gradeBg)}>
            <span class=${cn('text-2xl font-black', gradeColor)}>Grade ${grade}</span>
          </div>
        </div>

        <div class="space-y-3">
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p class="text-xs text-slate-700 font-medium leading-relaxed">${msg}</p>
          </div>
          ${danger.length > 0 && html`
            <div class="p-3 bg-red-50 rounded-xl border border-red-100">
              <div class="flex items-center gap-1.5 mb-1.5">
                <${AlertTriangleIcon} className="w-3 h-3 text-red-500" />
                <span class="text-[10px] font-black text-red-600 uppercase tracking-wide">Same-bet groups</span>
              </div>
              ${danger.map(p => html`
                <div key=${p.a + p.b} class="flex items-center gap-2 text-[10px] text-red-700 font-medium mb-0.5">
                  <div class="flex -space-x-1">
                    <div class="w-3 h-3 rounded-full border border-white" style=${{ backgroundColor: p.colA }} />
                    <div class="w-3 h-3 rounded-full border border-white" style=${{ backgroundColor: p.colB }} />
                  </div>
                  ${p.a} + ${p.b} → <span class="font-black">${(p.r * 100).toFixed(0)}%</span>
                </div>`)}
            </div>`}
          ${hedge.length > 0 && html`
            <div class="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <div class="flex items-center gap-1.5 mb-1.5">
                <${ShieldAlertIcon} className="w-3 h-3 text-emerald-500" />
                <span class="text-[10px] font-black text-emerald-600 uppercase tracking-wide">Counter-balancing pairs</span>
              </div>
              ${hedge.map(p => html`
                <div key=${p.a + p.b} class="flex items-center gap-2 text-[10px] text-emerald-700 font-medium mb-0.5">
                  <div class="flex -space-x-1">
                    <div class="w-3 h-3 rounded-full border border-white" style=${{ backgroundColor: p.colA }} />
                    <div class="w-3 h-3 rounded-full border border-white" style=${{ backgroundColor: p.colB }} />
                  </div>
                  ${p.a} + ${p.b} → <span class="font-black">${(p.r * 100).toFixed(0)}%</span>
                </div>`)}
            </div>`}
        </div>
      </div>
    </div>`;
}
