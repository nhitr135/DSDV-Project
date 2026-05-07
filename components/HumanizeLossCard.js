// components/HumanizeLossCard.js
// Act 2 — Slide 5: "Nhân hóa con số" (Humanize the loss)
// Don't show percentages. Show the reality: 5 years of savings → one motorbike.
// This is the single most emotional moment in the whole narrative.

import { html, useState } from '../lib.js';
import { REAL_RETURNS } from '../constants.js';
import { returnsToPriceIndex, computeDrawdown } from '../utils.js';

const PRESETS = [
  { label: '100 million VND', before: 100, suffix: 'M VND', context: '≈ 3 months of decent salary' },
  { label: '1 billion VND',   before: 1000, suffix: 'M VND', context: '≈ 5 years of disciplined saving' },
  { label: '$100,000',        before: 100, suffix: 'K USD',  context: '≈ A down payment on a home' },
];

function getBTCMaxDrawdown() {
  const returns = REAL_RETURNS.BTC || [];
  if (!returns.length) return -0.8;
  const dd = computeDrawdown(returnsToPriceIndex(returns));
  return Math.min(...dd);
}

export function HumanizeLossCard() {
  const [idx, setIdx] = useState(1); // default: 1 billion VND (most relatable for VN students)
  const preset = PRESETS[idx];
  const drawdown = getBTCMaxDrawdown(); // real BTC worst drawdown
  const after = preset.before * (1 + drawdown);
  const lost  = preset.before - after;

  // Scale height of "money stacks" based on relative value
  const beforeH = 180;
  const afterH  = beforeH * (after / preset.before);

  return html`
    <div class="bg-gradient-to-br from-red-950 via-slate-900 to-slate-900 p-8 rounded-3xl shadow-2xl border border-red-900/50">
      <div class="text-center mb-6">
        <div class="inline-block px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-[10px] font-black uppercase tracking-widest mb-3">
          The Reality Check
        </div>
        <h3 class="text-white text-2xl font-black">Forget percentages.</h3>
        <p class="text-slate-400 text-sm mt-1">Look at what you'd actually lose.</p>
      </div>

      <!-- Preset selector -->
      <div class="grid grid-cols-3 gap-2 mb-8">
        ${PRESETS.map((p, i) => html`
          <button key=${p.label} onClick=${() => setIdx(i)}
            class=${`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              idx === i
                ? 'bg-red-500 text-white shadow-lg'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}>
            ${p.label}
          </button>`)}
      </div>

      <!-- Money stacks -->
      <div class="flex items-end justify-center gap-12 mb-6" style=${{ minHeight: '220px' }}>
        <!-- Before -->
        <div class="flex flex-col items-center">
          <div class="text-emerald-400 text-3xl font-black mb-2">${preset.before}</div>
          <div class="text-slate-500 text-[10px] uppercase font-bold mb-3">${preset.suffix}</div>
          <div class="relative rounded-t-lg" style=${{
            width: '80px',
            height: `${beforeH}px`,
            background: 'linear-gradient(180deg, #10b981 0%, #047857 100%)',
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)'
          }}>
            <!-- Stack texture -->
            ${Array.from({ length: 8 }, (_, i) => html`
              <div key=${i} class="absolute w-full border-t border-emerald-900/40"
                style=${{ top: `${(i + 1) * (100 / 9)}%` }} />`)}
          </div>
          <div class="mt-3 text-[10px] text-slate-400 text-center max-w-[100px]">${preset.context}</div>
        </div>

        <!-- Arrow -->
        <div class="flex flex-col items-center self-center mb-10">
          <div class="text-red-400 text-3xl">↘</div>
          <div class="text-red-400 text-[10px] font-black mt-1">BTC CRASH</div>
          <div class="text-red-300 text-lg font-black mt-0.5">${(drawdown * 100).toFixed(0)}%</div>
        </div>

        <!-- After -->
        <div class="flex flex-col items-center">
          <div class="text-red-400 text-3xl font-black mb-2">${after.toFixed(0)}</div>
          <div class="text-slate-500 text-[10px] uppercase font-bold mb-3">${preset.suffix}</div>
          <div class="relative rounded-t-lg" style=${{
            width: '80px',
            height: `${Math.max(afterH, 20)}px`,
            background: 'linear-gradient(180deg, #dc2626 0%, #7f1d1d 100%)',
            boxShadow: '0 0 20px rgba(239, 68, 68, 0.4)'
          }}>
            ${Array.from({ length: Math.max(1, Math.floor(afterH / 22)) }, (_, i) => html`
              <div key=${i} class="absolute w-full border-t border-red-950/50"
                style=${{ top: `${(i + 1) * (100 / Math.max(2, Math.floor(afterH / 22) + 1))}%` }} />`)}
          </div>
          <div class="mt-3 text-[10px] text-red-300 text-center max-w-[100px] font-bold">
            That's all that's left.
          </div>
        </div>
      </div>

      <!-- Punch line -->
      <div class="text-center p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
        <div class="text-red-300 text-[10px] font-black uppercase tracking-widest mb-1">What you lost</div>
        <div class="text-white text-2xl font-black">
          ${lost.toFixed(0)} ${preset.suffix} — <span class="text-red-400">gone.</span>
        </div>
        <div class="text-slate-400 text-sm mt-2">
          Years of work. One bad bet. A 12-month window.
        </div>
      </div>
    </div>`;
}
