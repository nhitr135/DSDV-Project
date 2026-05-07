// components/TakeawayCards.js
// Act 6 — Slide 20: The 3 takeaways
// The closing summary. Short, punchy, memorable.

import { html } from '../lib.js';

export function TakeawayCards() {
  return html`
    <div class="py-8">
      <div class="mt-10 text-center p-6 rounded-3xl bg-slate-900">
        <p class="text-white text-xl font-black italic leading-tight">
          "In an unpredictable world,
          <span class="text-emerald-400"> diversification</span> is
          <span class="text-red-400"> survival.</span>"
        </p>
      </div>
    </div>`;
}
