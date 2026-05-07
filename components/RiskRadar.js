// components/RiskRadar.js
import { html, useMemo } from '../lib.js';
import { calculatePortfolioRisk, calculateCorrelation, compute95VaR } from '../utils.js';
import { RISK_RADAR_VOL_CAP } from '../constants.js';

export function RiskRadar({ assets }) {
  const metrics = useMemo(() => {
    if (!assets.length) return null;
    const totalW  = assets.reduce((s, a) => s + a.weight, 0) || 1;
    const weights = assets.map(a => a.weight / totalW);

    const portRisk   = calculatePortfolioRisk(assets.map(a => a.returns), weights);
    // Volatility axis: cap at RISK_RADAR_VOL_CAP (50% annual) — matches RiskMeter's
    // upper bound. Highly volatile portfolios (heavy crypto/single-name tech)
    // peg here without crowding the radar visualization.
    const volatility = Math.min(portRisk * Math.sqrt(252) / RISK_RADAR_VOL_CAP, 1);

    const maxW = Math.max(...weights);
    const concentration = Math.min(maxW / 0.6, 1);

    const pairs = [];
    for (let i = 0; i < assets.length; i++)
      for (let j = i + 1; j < assets.length; j++)
        pairs.push(calculateCorrelation(assets[i].returns, assets[j].returns));
    const avgCorr   = pairs.length ? pairs.reduce((s, r) => s + r, 0) / pairs.length : 0;
    const correlation = (avgCorr + 1) / 2;

    // Tail Risk: 95% historical VaR. The threshold loss on the worst 5% of days.
    // Universal — every portfolio has it — and a standard finance metric, so
    // it ages better than the ad-hoc "Crypto Risk" axis. Cap axis at -8% daily
    // (worse than COVID's worst single days for an SPY-like portfolio); BTC-
    // heavy mixes still peg the axis at extremely negative VaR values.
    const var95   = compute95VaR(assets, weights);
    const TAIL_CAP = 0.08;
    const tailRisk = Math.min(Math.abs(var95) / TAIL_CAP, 1);

    const sectors   = assets.reduce((acc, a) => { acc[a.sector || 'Other'] = (acc[a.sector || 'Other'] || 0) + a.weight / totalW; return acc; }, {});
    const maxSector  = Math.max(...Object.values(sectors));
    const sectorRisk = Math.min(maxSector / 0.7, 1);

    return [
      { label: 'Volatility',    value: volatility,    desc: `${(portRisk * Math.sqrt(252) * 100).toFixed(0)}% annual` },
      { label: 'Concentration', value: concentration,  desc: `Top holding: ${(maxW * 100).toFixed(0)}%` },
      { label: 'Correlation',   value: correlation,    desc: `Avg: ${(avgCorr * 100).toFixed(0)}%` },
      { label: 'Tail Risk',     value: tailRisk,       desc: `Worst-5% day: ${(var95 * 100).toFixed(1)}%` },
      { label: 'Sector Risk',   value: sectorRisk,     desc: `Top sector: ${(maxSector * 100).toFixed(0)}%` },
    ];
  }, [assets]);

  if (!metrics) return null;

  const cx = 130, cy = 120, R = 80, n = metrics.length;
  const angleStep = (2 * Math.PI) / n;
  const angle = i => -Math.PI / 2 + i * angleStep;
  const pt    = (i, r) => ({ x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) });

  const rings      = [0.25, 0.5, 0.75, 1.0];
  const ringColors = ['#dcfce7', '#fef9c3', '#fed7aa', '#fecaca'];

  const polyPoints  = r => metrics.map((_, i) => { const p = pt(i, r * R); return `${p.x},${p.y}`; }).join(' ');
  const valuePoints = metrics.map((m, i) => { const p = pt(i, m.value * R); return `${p.x},${p.y}`; }).join(' ');

  const overallRisk = Math.round(metrics.reduce((s, m) => s + m.value, 0) / metrics.length * 100);
  const riskColor   = overallRisk > 66 ? '#ef4444' : overallRisk > 33 ? '#f59e0b' : '#10b981';

  return html`
    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div class="flex items-center gap-2 mb-4">
        <div class="p-1.5 bg-rose-50 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="#e11d48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <div>
          <h2 class="text-sm font-bold uppercase tracking-tight">Risk Radar</h2>
          <p class="text-[10px] text-slate-400 font-medium">5 dimensions of your portfolio risk</p>
        </div>
        <div class="ml-auto text-right">
          <div class="text-xl font-black" style=${{ color: riskColor }}>${overallRisk}</div>
          <div class="text-[9px] text-slate-400 font-bold uppercase">Risk Score</div>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <div class="flex justify-center">
          <svg viewBox="0 0 260 240" preserveAspectRatio="xMidYMid meet"
            class="w-full max-w-[280px] h-auto">
            ${rings.map((r, i) => html`
              <polygon key=${r} points=${polyPoints(r)}
                fill=${ringColors[i]} fill-opacity="0.4" stroke="#e2e8f0" stroke-width="1" />`)}
            ${metrics.map((_, i) => {
              const p = pt(i, R);
              return html`<line key=${i} x1=${cx} y1=${cy} x2=${p.x} y2=${p.y} stroke="#e2e8f0" stroke-width="1" />`;
            })}
            <polygon points=${valuePoints}
              fill=${riskColor} fill-opacity="0.18" stroke=${riskColor} stroke-width="2" stroke-linejoin="round" />
            ${metrics.map((m, i) => {
              const p = pt(i, m.value * R);
              return html`<circle key=${i} cx=${p.x} cy=${p.y} r="4" fill=${riskColor} stroke="white" stroke-width="1.5" />`;
            })}
            ${['Low', 'Med', 'High', 'Max'].map((l, i) => {
              const p = pt(0, rings[i] * R);
              return html`<text key=${l} x=${p.x + 3} y=${p.y - 2} font-size="8" fill="#94a3b8" font-weight="600">${l}</text>`;
            })}
            ${metrics.map((m, i) => {
              const labelR = R + 18;
              const p      = pt(i, labelR);
              const anchor = Math.abs(Math.cos(angle(i))) < 0.1 ? 'middle' : Math.cos(angle(i)) > 0 ? 'start' : 'end';
              return html`
                <g key=${i}>
                  <text x=${p.x} y=${p.y}      text-anchor=${anchor} font-size="10" font-weight="800" fill="#374151">${m.label}</text>
                  <text x=${p.x} y=${p.y + 11} text-anchor=${anchor} font-size="9"  fill="#64748b">${m.desc}</text>
                </g>`;
            })}
          </svg>
        </div>

        <div class="space-y-2.5">
          ${metrics.map(m => {
            const pct   = Math.round(m.value * 100);
            const col   = pct > 66 ? '#ef4444' : pct > 33 ? '#f59e0b' : '#10b981';
            const label = pct > 66 ? 'High' : pct > 33 ? 'Medium' : 'Low';
            return html`
              <div key=${m.label}>
                <div class="flex justify-between items-center mb-1">
                  <span class="text-[11px] font-bold text-slate-700">${m.label}</span>
                  <div class="flex items-center gap-1.5">
                    <span class="text-[10px] text-slate-500">${m.desc}</span>
                    <span class="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                      style=${{ backgroundColor: col + '20', color: col }}>${label}</span>
                  </div>
                </div>
                <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all duration-700"
                    style=${{ width: `${pct}%`, backgroundColor: col }} />
                </div>
              </div>`;
          })}
          <div class="mt-3 pt-3 border-t border-slate-100">
            <p class="text-[11px] text-slate-600 leading-relaxed">
              ${overallRisk > 66
                ? '⚠️ Your portfolio carries significant risk across multiple dimensions. Consider adding low-volatility, uncorrelated assets.'
                : overallRisk > 33
                ? '⚖️ Your portfolio has a moderate risk profile. A few adjustments could meaningfully improve your risk balance.'
                : '✅ Your portfolio shows a well-balanced risk profile across all five dimensions.'}
            </p>
          </div>
        </div>
      </div>
    </div>`;
}
