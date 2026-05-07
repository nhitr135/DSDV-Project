// components/AssetPickerModal.js
import { html, useState } from '../lib.js';
import { ASSET_CATALOG, SECTOR_COLORS } from '../constants.js';

export function AssetPickerModal({ existingSymbols, onAdd, onClose }) {
  const [search, setSearch] = useState('');

  const available = ASSET_CATALOG.filter(a =>
    !existingSymbols.has(a.symbol) &&
    (a.symbol.toLowerCase().includes(search.toLowerCase()) ||
     a.name.toLowerCase().includes(search.toLowerCase()) ||
     a.sector.toLowerCase().includes(search.toLowerCase()))
  );
  const sectors = [...new Set(available.map(a => a.sector))];

  return html`
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4"
      style=${{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-enter overflow-hidden">
        <div class="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 class="font-bold text-slate-800 text-sm">Add Asset</h3>
            <p class="text-[10px] text-slate-400 mt-0.5">Choose from ${ASSET_CATALOG.length} assets</p>
          </div>
          <button onClick=${onClose}
            class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors text-lg leading-none">×</button>
        </div>
        <div class="p-3 border-b border-slate-100">
          <input autoFocus type="text" placeholder="Search by symbol, name, or sector…"
            value=${search} onChange=${e => setSearch(e.target.value)}
            class="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all" />
        </div>
        <div class="max-h-72 overflow-y-auto custom-scrollbar p-2">
          ${available.length === 0
            ? html`<div class="text-center py-8 text-slate-400 text-xs">No assets found</div>`
            : sectors.map(sector => html`
                <div key=${sector} class="mb-2">
                  <div class="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400">${sector}</div>
                  ${available.filter(a => a.sector === sector).map(asset => html`
                    <button key=${asset.symbol} onClick=${() => onAdd(asset)}
                      class="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left">
                      <div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm"
                        style=${{ backgroundColor: asset.color }}>${asset.symbol[0]}</div>
                      <div class="flex-1 min-w-0">
                        <div class="font-bold text-slate-800 text-xs">${asset.symbol}</div>
                        <div class="text-[10px] text-slate-400 truncate">${asset.name}</div>
                      </div>
                      <div class="text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style=${{ backgroundColor: (SECTOR_COLORS[sector] || '#94a3b8') + '20', color: SECTOR_COLORS[sector] || '#94a3b8' }}>
                        ${sector}
                      </div>
                    </button>`)}
                </div>`)}
        </div>
      </div>
    </div>`;
}
