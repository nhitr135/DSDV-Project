// components/InvestorPsychology.js
// Act 2 — Slide 6: "You won't HODL" (Behavioral attack)
// Emotional timeline showing why most investors sell at the bottom.

import { html } from '../lib.js';

const STAGES = [
  { emoji: '😍', label: 'Euphoria',     color: '#10b981', bgColor: '#ecfdf5', note: '"I\'m a genius!"',    phase: 'peak',   verticalPct: 90 },
  { emoji: '😰', label: 'Anxiety',      color: '#84cc16', bgColor: '#f7fee7', note: '"It\'ll bounce..."',  phase: 'fall',   verticalPct: 70 },
  { emoji: '😶', label: 'Denial',       color: '#eab308', bgColor: '#fefce8', note: '"Long-term play"',    phase: 'fall',   verticalPct: 50 },
  { emoji: '😱', label: 'PANIC',        color: '#ef4444', bgColor: '#fef2f2', note: '"I need to SELL."',   phase: 'bottom', verticalPct: 20 },
  { emoji: '🏳️', label: 'Capitulation',color: '#b91c1c', bgColor: '#fee2e2', note: 'Sell at the low',    phase: 'bottom', verticalPct: 10 },
  { emoji: '📈', label: 'Recovery',     color: '#3b82f6', bgColor: '#eff6ff', note: 'Missed the rebound',  phase: 'rise',   verticalPct: 60 },
];

export function InvestorPsychology() {
  return html`
    <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
      <div class="mb-5 text-center">
        <div class="inline-block px-3 py-1 rounded-full bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest mb-2">
          Behavioral Attack
        </div>
        <h3 class="text-slate-900 text-xl font-black">You think you'll HODL. You won't.</h3>
        <p class="text-slate-500 text-sm mt-1">98% of retail investors sell near the bottom — here's why.</p>
      </div>

      <!-- Curve visualization — taller container so the TRAP banner can live
           ABOVE the PANIC emoji without overlapping. Container height bumped
           220 → 320 to accommodate enlarged TRAP banner + spaced markers. -->
      <div class="relative px-2" style=${{ height: '320px' }}>
        <!-- Curve uses preserveAspectRatio="none" to flex with container.
             The TRAP banner CANNOT live in this stretched SVG (text would
             warp horizontally), so we render it as HTML overlay below. -->
        <svg class="absolute inset-0 w-full h-full" viewBox="0 0 600 320" preserveAspectRatio="none">
          <defs>
            <linearGradient id="psyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"  stop-color="#10b981" />
              <stop offset="35%" stop-color="#eab308" />
              <stop offset="60%" stop-color="#ef4444" />
              <stop offset="100%" stop-color="#3b82f6" />
            </linearGradient>
          </defs>
          <!-- Emotional curve: up → down → up. Stretched proportionally to
               match the new container height (220 → 320, factor 1.45). -->
          <path
            d="M 20 32 C 80 16, 140 22, 200 95 S 320 290, 400 287 S 520 175, 580 125"
            fill="none" stroke="url(#psyGrad)" stroke-width="3" stroke-linecap="round" />
        </svg>

        <!-- THE TRAP banner — bigger, positioned above PANIC marker.
             Pulled to ~38% vertical (well above the curve trough at 75-80%).
             pointer-events-none lets users still hover the markers underneath. -->
        <div class="absolute pointer-events-none"
          style=${{ left: '60%', top: '38%', transform: 'translate(-50%, -50%)' }}>
          <div class="bg-red-50 px-4 py-2.5 rounded-lg text-center shadow-md border-2 border-red-300/80">
            <div class="text-base font-black text-red-700 leading-none tracking-wider uppercase">⚠ The Trap</div>
            <div class="text-[11px] text-red-600 italic leading-tight mt-1.5 font-semibold">most people sell here</div>
          </div>
          <!-- Pointer tail — visually points down from TRAP toward PANIC emoji -->
          <div class="mx-auto mt-1 w-px h-6 bg-red-300/80"></div>
        </div>

        <!-- Stage markers — emoji bumped 40px → 52px so they read clearly
             on screen and don't get crowded by the TRAP banner above. -->
        <div class="absolute inset-0 flex justify-between items-center">
          ${STAGES.map((s, i) => html`
            <div key=${s.label} class="relative flex flex-col items-center"
              style=${{ marginTop: `${-(s.verticalPct - 50) * 2.6}px` }}>
              <div class="rounded-full flex items-center justify-center shadow-md border-2 border-white text-2xl z-10"
                style=${{
                  backgroundColor: s.bgColor,
                  width: '52px',
                  height: '52px',
                  animation: s.label === 'PANIC' ? 'pulseGlow 2s infinite' : 'none',
                }}>
                ${s.emoji}
              </div>
            </div>`)}
        </div>
      </div>

      <!-- Stage labels below — bumped from text-[10px]/text-[9px] up so they
           are actually legible at slide-projector distance. -->
      <div class="mt-5 flex justify-between gap-1">
        ${STAGES.map(s => html`
          <div key=${s.label} class="flex-1 text-center px-1">
            <div class="text-[12px] font-black uppercase tracking-tight" style=${{ color: s.color }}>
              ${s.label}
            </div>
            <div class="text-[11px] text-slate-600 mt-0.5 italic leading-snug">${s.note}</div>
          </div>`)}
      </div>

      <!-- Punchline -->
      <div class="mt-5 p-4 rounded-2xl bg-slate-900 text-center">
        <p class="text-white text-base font-bold leading-relaxed">
          "Returns only go to those who survive to the end —
          <span class="text-red-400">and most people don't.</span>"
        </p>
        <p class="text-slate-400 text-xs mt-2">
          Ask yourself honestly: could you watch your account fall 70% for 2 years without selling?
        </p>
      </div>
    </div>`;
}
