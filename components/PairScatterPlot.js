// components/PairScatterPlot.js
import { html, useRef, useEffect } from '../lib.js';
import { calculateStandardDeviation } from '../utils.js';

export function PairScatterPlot({ a1, a2, r, width = 420, height = 320 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !a1 || !a2) return;
    const W = width, H = height;
    const mg = { top: 24, right: 28, bottom: 44, left: 56 };
    const iw = W - mg.left - mg.right;
    const ih = H - mg.top  - mg.bottom;

    d3.select(ref.current).selectAll('*').remove();
    // Use viewBox + width:100% so the chart shrinks/grows with its parent
    // panel (previous fixed width caused dots to render OUTSIDE the panel
    // when the InsightPanel column was narrower than 360px).
    const root = d3.select(ref.current)
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('width', '100%')
      .style('height', 'auto')
      .style('display', 'block');
    const svg = root.append('g').attr('transform', `translate(${mg.left},${mg.top})`);

    const n   = Math.min(a1.returns.length, a2.returns.length);
    const pts = Array.from({ length: n }, (_, i) => ({ x: a1.returns[i] * 100, y: a2.returns[i] * 100 }));
    const xExt = d3.extent(pts, d => d.x);
    const yExt = d3.extent(pts, d => d.y);
    // Bumped pad 0.4 → 0.8 so the most extreme daily moves get breathing
    // room from the axis; previously some BTC outliers (~30% daily) sat
    // visually flush against the right edge.
    const pad  = 0.8;
    const xS   = d3.scaleLinear().domain([xExt[0] - pad, xExt[1] + pad]).range([0, iw]);
    const yS   = d3.scaleLinear().domain([yExt[0] - pad, yExt[1] + pad]).range([ih, 0]);

    // Quadrant backgrounds
    const midX = xS(0), midY = yS(0);
    svg.append('rect').attr('x', midX).attr('y', 0).attr('width', iw - midX).attr('height', midY)
      .style('fill', '#f0fdf4').style('opacity', 0.6);
    svg.append('rect').attr('x', 0).attr('y', midY).attr('width', midX).attr('height', ih - midY)
      .style('fill', '#fef2f2').style('opacity', 0.6);

    // Grid lines
    const xTicks = xS.ticks(5);
    const yTicks = yS.ticks(5);
    xTicks.forEach(t => {
      svg.append('line').attr('x1', xS(t)).attr('x2', xS(t)).attr('y1', 0).attr('y2', ih)
        .style('stroke', '#e2e8f0').style('stroke-width', 0.5);
    });
    yTicks.forEach(t => {
      svg.append('line').attr('x1', 0).attr('x2', iw).attr('y1', yS(t)).attr('y2', yS(t))
        .style('stroke', '#e2e8f0').style('stroke-width', 0.5);
    });

    // Zero axes (bold)
    svg.append('line').attr('x1', xS(0)).attr('x2', xS(0)).attr('y1', 0).attr('y2', ih)
      .style('stroke', '#cbd5e1').style('stroke-width', 1.5).style('stroke-dasharray', '4,3');
    svg.append('line').attr('x1', 0).attr('x2', iw).attr('y1', yS(0)).attr('y2', yS(0))
      .style('stroke', '#cbd5e1').style('stroke-width', 1.5).style('stroke-dasharray', '4,3');

    // Regression line: slope = r * (stdY / stdX) — names now match content
    const xMean = d3.mean(pts, d => d.x);
    const yMean = d3.mean(pts, d => d.y);
    const stdX  = calculateStandardDeviation(pts.map(d => d.x));
    const stdY  = calculateStandardDeviation(pts.map(d => d.y));
    const slope = stdX !== 0 ? r * (stdY / stdX) : 0;
    const trendColor = r > 0.3 ? '#ef4444' : r < -0.3 ? '#10b981' : '#94a3b8';
    const x0 = xExt[0] - pad, x1c = xExt[1] + pad;
    svg.append('line')
      .attr('x1', xS(x0)).attr('x2', xS(x1c))
      .attr('y1', yS(yMean + slope * (x0 - xMean))).attr('y2', yS(yMean + slope * (x1c - xMean)))
      .style('stroke', trendColor).style('stroke-width', 2).style('stroke-dasharray', '6,3').style('opacity', 0.8);

    // Points — larger, colored by quadrant
    svg.selectAll('circle').data(pts).enter().append('circle')
      .attr('cx', d => xS(d.x)).attr('cy', d => yS(d.y)).attr('r', 4)
      .style('fill', d => {
        if (d.x > 0 && d.y > 0) return '#10b981';
        if (d.x < 0 && d.y < 0) return '#f87171';
        return '#94a3b8';
      })
      .style('opacity', 0.7)
      .style('stroke', 'white').style('stroke-width', 1);

    // Axis ticks
    svg.append('g').attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(xS).ticks(5).tickFormat(d => d + '%'))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('line').style('stroke', '#e2e8f0'))
      .call(g => g.selectAll('text').style('font-size', '11px').style('fill', '#64748b').style('font-weight', '600'));
    svg.append('g')
      .call(d3.axisLeft(yS).ticks(5).tickFormat(d => d + '%'))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('line').style('stroke', '#e2e8f0'))
      .call(g => g.selectAll('text').style('font-size', '11px').style('fill', '#64748b').style('font-weight', '600'));

    // Axis labels
    svg.append('text').attr('x', iw / 2).attr('y', ih + 38).attr('text-anchor', 'middle')
      .text(a1.symbol + ' daily return').style('font-size', '12px').style('font-weight', '800').style('fill', a1.color);
    svg.append('text').attr('transform', `translate(-40,${ih / 2}) rotate(-90)`).attr('text-anchor', 'middle')
      .text(a2.symbol + ' daily return').style('font-size', '12px').style('font-weight', '800').style('fill', a2.color);

    // Quadrant labels (corner)
    svg.append('text').attr('x', iw - 4).attr('y', 14).attr('text-anchor', 'end')
      .text('Both ↑').style('font-size', '10px').style('fill', '#10b981').style('font-weight', '700').style('opacity', 0.75);
    svg.append('text').attr('x', 4).attr('y', ih - 6).attr('text-anchor', 'start')
      .text('Both ↓').style('font-size', '10px').style('fill', '#f87171').style('font-weight', '700').style('opacity', 0.75);
    svg.append('text').attr('x', iw - 4).attr('y', ih - 6).attr('text-anchor', 'end')
      .text('Diverge').style('font-size', '10px').style('fill', '#94a3b8').style('font-weight', '700').style('opacity', 0.75);
  }, [a1, a2, r, width, height]);

  if (!a1 || !a2 || !a1.returns?.length) return null;

  const bothUpPct  = Math.round(a1.returns.filter((v, i) => v > 0 && a2.returns[i] > 0).length / a1.returns.length * 100);
  const bothDnPct  = Math.round(a1.returns.filter((v, i) => v < 0 && a2.returns[i] < 0).length / a1.returns.length * 100);
  const divergePct = 100 - bothUpPct - bothDnPct;

  return html`
    <div>
      <svg ref=${ref} style=${{ display: 'block' }} />
      <div class="flex justify-around mt-3 text-center">
        <div class="px-4 py-2 bg-emerald-50 rounded-xl">
          <div class="text-lg font-black text-emerald-600">${bothUpPct}%</div>
          <div class="text-[11px] text-emerald-700 font-semibold">Both rise</div>
        </div>
        <div class="px-4 py-2 bg-red-50 rounded-xl">
          <div class="text-lg font-black text-red-500">${bothDnPct}%</div>
          <div class="text-[11px] text-red-600 font-semibold">Both fall</div>
        </div>
        <div class="px-4 py-2 bg-slate-100 rounded-xl">
          <div class="text-lg font-black text-slate-600">${divergePct}%</div>
          <div class="text-[11px] text-slate-600 font-semibold">Diverge</div>
        </div>
      </div>
    </div>`;
}
