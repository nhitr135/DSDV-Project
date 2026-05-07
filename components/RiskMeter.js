// components/RiskMeter.js
import { html } from '../lib.js';
import { VOL_THRESHOLD, RISK_RADAR_VOL_CAP } from '../constants.js';

export function RiskMeter({ risk }) {
  // `risk` is daily std-dev. Annualize for human-readable boundaries.
  const annualVol = risk * Math.sqrt(252);

  // Label uses the centralized thresholds so RiskMeter and RiskRadar agree.
  let label, bar, txt;
  if (annualVol >= VOL_THRESHOLD.ANNUAL_HIGH) {
    label = 'High Risk';   bar = '#ef4444'; txt = '#fca5a5';
  } else if (annualVol >= VOL_THRESHOLD.ANNUAL_LOW) {
    label = 'Medium Risk'; bar = '#f59e0b'; txt = '#fcd34d';
  } else {
    label = 'Low Risk';    bar = '#10b981'; txt = '#6ee7b7';
  }

  // Bar fill: scale to the same upper bound RiskRadar uses for its volatility
  // axis (~50% annual). At ANNUAL_HIGH (30%) the bar is 60% full, which
  // visually agrees with the colour change to red.
  const pct = Math.min(annualVol / RISK_RADAR_VOL_CAP, 1) * 100;

  return html`
    <div>
      <div class="flex justify-between items-end mb-2">
        <span class="text-[11px] font-bold uppercase tracking-widest" style=${{ color: txt }}>${label}</span>
        <div class="text-right">
          <div class="text-3xl font-black text-white leading-none">${(risk * 100).toFixed(2)}%</div>
          <div class="text-[10px] text-slate-400 mt-0.5">${(annualVol * 100).toFixed(0)}% annualized</div>
        </div>
      </div>
      <div class="h-2.5 rounded-full overflow-hidden mb-1.5" style=${{ background: 'rgba(255,255,255,0.1)' }}>
        <div class="h-full rounded-full transition-all duration-500" style=${{ width: `${pct}%`, backgroundColor: bar }} />
      </div>
      <div class="flex justify-between text-[10px] text-slate-500">
        <span>0%</span>
        <span>Day-to-day swing</span>
        <span>${(RISK_RADAR_VOL_CAP * 100).toFixed(0)}% annual</span>
      </div>
    </div>`;
}
