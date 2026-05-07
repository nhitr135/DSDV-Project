// components/PortfolioWeights.js
import { html } from '../lib.js';
import { cn } from '../utils.js';
import { PlusIcon, Trash2Icon } from './icons.js';

export function PortfolioWeights({ assets, assetsWithWeight, totalAmount, onAdd, onRemove, onAmountChange }) {
  return html`
    <section class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div class="flex justify-between items-center mb-2">
        <h2 class="text-lg font-semibold flex items-center gap-2">
          Portfolio Weights
          <span class="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">${assets.length}</span>
        </h2>
        <button onClick=${onAdd}
          class="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold transition-colors">
          <${PlusIcon} className="w-3 h-3" /> Add
        </button>
      </div>

      <div class="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Invested</span>
        <span class="text-sm font-black text-slate-800">
          $${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </span>
      </div>

      <div class="space-y-3 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
        ${assetsWithWeight.map(asset => {
          const pct = (asset.weight * 100).toFixed(1);
          return html`
            <div key=${asset.id} class="group bg-slate-50 p-3.5 rounded-xl border border-transparent hover:border-slate-200 transition-all">
              <div class="flex items-center justify-between mb-2.5">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0"
                    style=${{ backgroundColor: asset.color }}>${asset.symbol[0]}</div>
                  <div>
                    <div class="font-bold text-slate-800 text-sm leading-tight">${asset.symbol}</div>
                    <div class="text-[9px] text-slate-400 font-medium">${asset.name}</div>
                  </div>
                </div>
                <button onClick=${() => onRemove(asset.id)}
                  class="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-400 transition-all">
                  <${Trash2Icon} className="w-3.5 h-3.5" />
                </button>
              </div>

              <div class="flex items-center gap-2">
                <div class="relative flex-1">
                  <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                  <input type="number" min="0" step="100"
                    value=${asset.amount || ''}
                    placeholder="0"
                    onChange=${e => onAmountChange(asset.id, e.target.value)}
                    class="w-full pl-6 pr-2 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all" />
                </div>
                <div class="shrink-0 text-right">
                  <div class="text-xs font-black text-slate-700">${pct}%</div>
                  <div class="text-[9px] text-slate-400 leading-tight">of total</div>
                </div>
              </div>

              <div class="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500"
                  style=${{ width: `${pct}%`, backgroundColor: asset.color }} />
              </div>
            </div>`;
        })}
      </div>
    </section>`;
}
