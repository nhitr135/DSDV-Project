// components/AllocationPieChart.js
// Allocation viewer with pie ↔ bar toggle.
// Pie is great for ≤6 assets; with 8+ slices it becomes a confetti chart and
// labels collide. Bar mode keeps every asset readable regardless of count.
// Default mode auto-selects: bar when >6 assets, pie otherwise.

import { html, useRef, useEffect, useState } from '../lib.js';
import { PieChartIcon, BarChart2Icon } from './icons.js';

export function AllocationPieChart({ assets }) {
  const ref = useRef(null);
  const totalAmount = assets.reduce((s, a) => s + (a.amount || 0), 0);
  const visible = assets.filter(a => (a.amount || 0) > 0).sort((a, b) => b.amount - a.amount);

  // Auto-select bar mode when many assets, but let the user override.
  // `userMode` null = follow auto-default; otherwise locked to user's choice.
  const [userMode, setUserMode] = useState(null);
  const autoMode = visible.length > 6 ? 'bar' : 'pie';
  const mode = userMode ?? autoMode;

  // Pie chart effect — runs when in pie mode
  useEffect(() => {
    if (mode !== 'pie' || !ref.current) return;
    const size = 200, R = 82, innerR = 48;
    d3.select(ref.current).selectAll('*').remove();
    const svg = d3.select(ref.current)
      .attr('viewBox', `0 0 ${size} ${size}`).attr('width', '100%').attr('height', size);
    const g = svg.append('g').attr('transform', `translate(${size / 2},${size / 2})`);

    if (visible.length === 0) {
      g.append('text').attr('text-anchor', 'middle').attr('dy', '-.2em')
        .text('Enter amounts').style('font-size', '11px').style('fill', '#94a3b8').style('font-weight', '600');
      g.append('text').attr('text-anchor', 'middle').attr('dy', '1em')
        .text('above to see chart').style('font-size', '11px').style('fill', '#94a3b8').style('font-weight', '600');
      return;
    }

    const pie = d3.pie().value(d => d.amount).sort(null)(visible);
    const arc      = d3.arc().innerRadius(innerR).outerRadius(R).cornerRadius(3).padAngle(0.03);
    const arcHover = d3.arc().innerRadius(innerR).outerRadius(R + 7).cornerRadius(3).padAngle(0.03);

    const slices = g.selectAll('path').data(pie).enter().append('path')
      .attr('d', arc).attr('fill', d => d.data.color).style('cursor', 'pointer');

    const fmt = v => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`;
    const label    = g.append('text').attr('text-anchor', 'middle').attr('dy', '-0.15em')
      .style('font-size', '12px').style('font-weight', '800').style('fill', '#1e293b').text('Portfolio');
    const sublabel = g.append('text').attr('text-anchor', 'middle').attr('dy', '1.1em')
      .style('font-size', '10px').style('font-weight', '700').style('fill', '#64748b').text(fmt(totalAmount));

    slices
      .on('mouseover', function (ev, d) {
        d3.select(this).transition().duration(150).attr('d', arcHover);
        label.text(d.data.symbol);
        sublabel.text(`${((d.data.amount / totalAmount) * 100).toFixed(1)}%`);
      })
      .on('mouseleave', function () {
        d3.select(this).transition().duration(150).attr('d', arc);
        label.text('Portfolio');
        sublabel.text(fmt(totalAmount));
      });
  }, [mode, assets, totalAmount, visible]);

  return html`
    <div class="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
      <div class="flex items-center gap-2 mb-3">
        <div class="p-1.5 bg-blue-50 rounded-lg"><${PieChartIcon} className="text-blue-500 w-4 h-4" /></div>
        <div class="flex-1 min-w-0">
          <h2 class="text-sm font-bold uppercase tracking-tight">Allocation</h2>
          <p class="text-[11px] text-slate-500 font-medium">
            ${mode === 'pie' ? 'Hover slices to explore' : `${visible.length} asset${visible.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <!-- View toggle -->
        <div class="flex bg-slate-100 p-0.5 rounded-lg">
          <button onClick=${() => setUserMode('pie')}
            class=${`p-1.5 rounded-md transition-colors ${mode === 'pie' ? 'bg-white shadow-sm' : 'hover:bg-slate-200/50'}`}
            title="Pie view">
            <${PieChartIcon} className=${`w-3.5 h-3.5 ${mode === 'pie' ? 'text-blue-600' : 'text-slate-400'}`} />
          </button>
          <button onClick=${() => setUserMode('bar')}
            class=${`p-1.5 rounded-md transition-colors ${mode === 'bar' ? 'bg-white shadow-sm' : 'hover:bg-slate-200/50'}`}
            title="Bar view">
            <${BarChart2Icon} className=${`w-3.5 h-3.5 ${mode === 'bar' ? 'text-blue-600' : 'text-slate-400'}`} />
          </button>
        </div>
      </div>

      ${mode === 'pie' && html`
        <svg ref=${ref} />
        ${visible.length > 0 && html`
          <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
            ${visible.map(a => html`
              <div key=${a.id} class="flex items-center gap-1.5 min-w-0">
                <div class="w-2.5 h-2.5 rounded-full shrink-0" style=${{ backgroundColor: a.color }} />
                <span class="text-[11px] font-bold text-slate-700 truncate">${a.symbol}</span>
                <span class="text-[10px] text-slate-500 ml-auto shrink-0 font-semibold">
                  ${totalAmount > 0 ? ((a.amount / totalAmount) * 100).toFixed(0) : 0}%
                </span>
              </div>`)}
          </div>`}`}

      ${mode === 'bar' && html`
        ${visible.length === 0
          ? html`<div class="py-8 text-center text-slate-400 text-xs font-semibold">Enter amounts above to see chart</div>`
          : html`
            <div class="space-y-2">
              ${visible.map(a => {
                const pct = totalAmount > 0 ? (a.amount / totalAmount) * 100 : 0;
                return html`
                  <div key=${a.id}>
                    <div class="flex items-center justify-between mb-0.5">
                      <div class="flex items-center gap-1.5 min-w-0">
                        <div class="w-2.5 h-2.5 rounded-full shrink-0" style=${{ backgroundColor: a.color }} />
                        <span class="text-[12px] font-bold text-slate-800 truncate">${a.symbol}</span>
                      </div>
                      <span class="text-[11px] font-black text-slate-700 tabular-nums shrink-0 ml-2">
                        ${pct.toFixed(0)}%
                      </span>
                    </div>
                    <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div class="h-full rounded-full transition-all duration-500"
                        style=${{ width: `${pct}%`, backgroundColor: a.color }} />
                    </div>
                  </div>`;
              })}
            </div>
            <div class="mt-3 pt-3 border-t border-slate-100 flex justify-between items-baseline">
              <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Total</span>
              <span class="text-sm font-black text-slate-800 tabular-nums">
                ${totalAmount >= 1000 ? `$${(totalAmount / 1000).toFixed(1)}K` : `$${totalAmount.toFixed(0)}`}
              </span>
            </div>`}`}
    </div>`;
}
