// components/CorrelationMatrix.js
import { html, useRef, useEffect } from '../lib.js';
import { calculateCorrelation } from '../utils.js';

export function CorrelationMatrix({ assets, onCellHover }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !assets.length) return;
    const mg = { top: 60, right: 20, bottom: 20, left: 60 };
    const W  = 380 - mg.left - mg.right;
    const H  = 380 - mg.top  - mg.bottom;
    d3.select(ref.current).selectAll('*').remove();
    const svg = d3.select(ref.current)
      .attr('width',  W + mg.left + mg.right)
      .attr('height', H + mg.top  + mg.bottom)
      .append('g').attr('transform', `translate(${mg.left},${mg.top})`);

    const labels = assets.map(a => a.symbol);
    const x = d3.scaleBand().range([0, W]).domain(labels).padding(0.06);
    const y = d3.scaleBand().range([0, H]).domain(labels).padding(0.06);

    // FIXED: red = high positive correlation (RISK), green/blue = negative (HEDGE)
    // Previously was inverted, which broke the "mind-blow heatmap" moment (docx Slide 12)
    const col = d3.scaleLinear()
      .domain([-1, 0, 1])
      .range(['#10b981', '#f8fafc', '#ef4444']);

    const data = [];
    assets.forEach(a1 => assets.forEach(a2 =>
      data.push({ x: a1.symbol, y: a2.symbol, r: calculateCorrelation(a1.returns, a2.returns), a1, a2 })
    ));

    svg.selectAll('rect').data(data).enter().append('rect')
      .attr('x', d => x(d.x) ?? 0).attr('y', d => y(d.y) ?? 0)
      .attr('rx', 5).attr('ry', 5)
      .attr('width', x.bandwidth()).attr('height', y.bandwidth())
      .style('fill', d => col(d.r)).style('stroke', '#e2e8f0').style('stroke-width', 1)
      .on('mouseover', function (ev, d) {
        d3.select(this).style('stroke', '#1e293b').style('stroke-width', 2.5);
        onCellHover(d.a1, d.a2, d.r);
      })
      .on('mouseleave', function () {
        d3.select(this).style('stroke', '#e2e8f0').style('stroke-width', 1);
        onCellHover(null, null, null);
      });

    svg.selectAll('text.val').data(data).enter().append('text')
      .attr('x', d => (x(d.x) ?? 0) + x.bandwidth() / 2)
      .attr('y', d => (y(d.y) ?? 0) + y.bandwidth() / 2)
      .attr('dy', '.35em').attr('text-anchor', 'middle')
      .text(d => `${Math.round(d.r * 100)}%`)
      .style('font-size', '11px').style('font-weight', '800')
      .style('fill', d => Math.abs(d.r) > 0.5 ? '#fff' : '#1e293b')
      .style('pointer-events', 'none');

    svg.append('g').attr('transform', 'translate(0,-10)').selectAll('text')
      .data(labels).enter().append('text')
      .attr('x', d => (x(d) ?? 0) + x.bandwidth() / 2).attr('y', 0)
      .attr('text-anchor', 'middle').text(d => d)
      .style('font-size', '13px').style('font-weight', '700').style('fill', '#475569');

    svg.append('g').attr('transform', 'translate(-10,0)').selectAll('text')
      .data(labels).enter().append('text')
      .attr('x', 0).attr('y', d => (y(d) ?? 0) + y.bandwidth() / 2)
      .attr('dy', '.35em').attr('text-anchor', 'end').text(d => d)
      .style('font-size', '13px').style('font-weight', '700').style('fill', '#475569');
  }, [assets]);

  return html`
    <div class="flex flex-col items-center bg-white p-3 rounded-xl border border-slate-100 overflow-x-auto">
      <svg ref=${ref} />
      <!-- Color-scale legend (essential for a correct mental model) -->
      <div class="mt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] font-bold text-slate-600">
        <div class="flex items-center gap-1.5">
          <div class="w-3 h-3 rounded" style=${{ backgroundColor: '#10b981' }}></div>
          <span>Counter-balancing (−100%)</span>
        </div>
        <div class="flex items-center gap-1.5">
          <div class="w-3 h-3 rounded border border-slate-200" style=${{ backgroundColor: '#f8fafc' }}></div>
          <span>Independent (0%)</span>
        </div>
        <div class="flex items-center gap-1.5">
          <div class="w-3 h-3 rounded" style=${{ backgroundColor: '#ef4444' }}></div>
          <span>Same-bet (+100%)</span>
        </div>
      </div>
    </div>`;
}
