// components/BTCDrawdownChart.js
// Act 2 — Slide 4: "Cú rơi của BTC" (The Wake-up Call)
// Shows BTC's drawdown curve using REAL returns, annotated at -50/-70/-80%.
// Now supports drag-to-zoom + hover tooltip showing the exact date.

import { html, useRef, useEffect, useMemo, useState } from '../lib.js';
import { REAL_RETURNS } from '../constants.js';
import { returnsToPriceIndex, computeDrawdown } from '../utils.js';
import {
  indexToDate,
  formatDate,
  pickTimeTicks,
  attachLineInteractions,
  drawHoverMarker,
} from '../chartHelpers.js';

export function BTCDrawdownChart() {
  const ref = useRef(null);

  // Build BTC drawdown series from REAL data
  const { dd, maxDrawdown } = useMemo(() => {
    const returns = REAL_RETURNS.BTC || [];
    if (!returns.length) return { dd: [], maxDrawdown: 0 };
    const prices = returnsToPriceIndex(returns);
    const dd = computeDrawdown(prices);
    const maxDrawdown = Math.min(...dd);
    return { dd, maxDrawdown };
  }, []);

  // Zoom state. domain = [start index, end index] inclusive.
  const n = dd.length;
  const [domain, setDomain] = useState([0, 0]); // re-initialised once dd is ready
  const [hoverIdx, setHoverIdx] = useState(null);

  // Initialise domain once data is ready
  useEffect(() => {
    if (n > 1 && (domain[1] === 0 || domain[1] >= n)) setDomain([0, n - 1]);
  }, [n]);

  const isZoomed = n > 1 && (domain[0] > 0 || domain[1] < n - 1);

  useEffect(() => {
    if (!ref.current || !dd.length || domain[1] === 0) return;
    // Enlarged from 760×380 → 1100×500. With ~2000 data points stretched
    // horizontally, the previous size felt cramped and the right-side
    // tooltip box collided with the max-drawdown annotation.
    const W = 1100, H = 500;
    const mg = { top: 30, right: 110, bottom: 50, left: 60 };
    const iw = W - mg.left - mg.right;
    const ih = H - mg.top - mg.bottom;

    d3.select(ref.current).selectAll('*').remove();
    const svg = d3.select(ref.current)
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('width', '100%');

    const g = svg.append('g').attr('transform', `translate(${mg.left},${mg.top})`);

    // ── Scales ────────────────────────────────────────────────────
    const xS = d3.scaleLinear().domain(domain).range([0, iw]);

    // Y domain: stay anchored to the worst value of the FULL series so the
    // visual "feel" of severity doesn't change as you zoom in.
    const yS = d3.scaleLinear()
      .domain([Math.min(-0.9, maxDrawdown - 0.02), 0])
      .range([ih, 0]);

    // ── Background danger zones ───────────────────────────────────
    const zones = [
      { y0: -0.5, y1: -0.7, color: '#fef3c7' },
      { y0: -0.7, y1: -0.9, color: '#fecaca' },
    ];
    zones.forEach(z => {
      g.append('rect')
        .attr('x', 0).attr('y', yS(z.y0))
        .attr('width', iw).attr('height', yS(z.y1) - yS(z.y0))
        .style('fill', z.color).style('opacity', 0.4);
    });

    // ── Threshold reference lines ─────────────────────────────────
    const thresholds = [-0.5, -0.7, -0.8];
    thresholds.forEach(t => {
      g.append('line')
        .attr('x1', 0).attr('x2', iw).attr('y1', yS(t)).attr('y2', yS(t))
        .style('stroke', '#ef4444').style('stroke-width', 1)
        .style('stroke-dasharray', '4,3').style('opacity', 0.6);
      g.append('text')
        .attr('x', iw + 8).attr('y', yS(t)).attr('dy', '.35em')
        .text(`${(t * 100).toFixed(0)}%`)
        .style('font-size', '11px').style('font-weight', '800').style('fill', '#dc2626');
    });

    // ── Drawdown area + line, clipped to the visible domain ───────
    const visible = dd
      .map((v, i) => ({ i, v }))
      .filter(d => d.i >= domain[0] && d.i <= domain[1]);

    // Gradient definition
    const defs = svg.append('defs');
    const grad = defs.append('linearGradient')
      .attr('id', 'dd-gradient').attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#fca5a5').attr('stop-opacity', 0.4);
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#dc2626').attr('stop-opacity', 0.9);

    const area = d3.area()
      .x(d => xS(d.i))
      .y0(yS(0))
      .y1(d => yS(d.v))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(visible)
      .attr('d', area)
      .style('fill', 'url(#dd-gradient)')
      .style('opacity', 0.85);

    const line = d3.line()
      .x(d => xS(d.i))
      .y(d => yS(d.v))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(visible)
      .attr('d', line)
      .style('fill', 'none').style('stroke', '#b91c1c').style('stroke-width', 2);

    // ── Y-axis ────────────────────────────────────────────────────
    g.append('g')
      .call(d3.axisLeft(yS).ticks(5).tickFormat(d => `${(d * 100).toFixed(0)}%`))
      .call(gg => gg.select('.domain').remove())
      .call(gg => gg.selectAll('line').style('stroke', '#e2e8f0'))
      .call(gg => gg.selectAll('text').style('font-size', '10px').style('fill', '#64748b').style('font-weight', '600'));

    // ── X-axis: smart time ticks driven by visible date range ────
    const ticks = pickTimeTicks(domain[0], domain[1], n, 8);
    g.append('g').attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(xS).tickValues(ticks.map(t => t.index))
        .tickFormat((d, i) => ticks[i]?.label ?? ''))
      .call(gg => gg.select('.domain').remove())
      .call(gg => gg.selectAll('line').style('stroke', '#e2e8f0'))
      .call(gg => gg.selectAll('text').style('font-size', '10px').style('fill', '#64748b').style('font-weight', '600'));

    // ── Max drawdown annotation (only if visible) ─────────────────
    const maxIdx = dd.indexOf(maxDrawdown);
    if (maxIdx >= domain[0] && maxIdx <= domain[1]) {
      g.append('circle')
        .attr('cx', xS(maxIdx)).attr('cy', yS(maxDrawdown))
        .attr('r', 6).style('fill', '#dc2626').style('stroke', '#fff').style('stroke-width', 2);

      const annX = Math.min(xS(maxIdx), iw - 180);
      const annY = yS(maxDrawdown) - 20;
      g.append('rect')
        .attr('x', annX + 8).attr('y', annY - 30)
        .attr('width', 170).attr('height', 50).attr('rx', 6)
        .style('fill', '#7f1d1d').style('stroke', '#dc2626').style('stroke-width', 1);
      g.append('text')
        .attr('x', annX + 16).attr('y', annY - 14)
        .text(`Max drawdown: ${(maxDrawdown * 100).toFixed(0)}%`)
        .style('font-size', '12px').style('font-weight', '900').style('fill', '#fff');
      g.append('text')
        .attr('x', annX + 16).attr('y', annY)
        .text(formatDate(indexToDate(maxIdx, n)))
        .style('font-size', '10px').style('fill', '#fca5a5');
      g.append('text')
        .attr('x', annX + 16).attr('y', annY + 14)
        .text(`$100K → $${Math.round(100 * (1 + maxDrawdown))}K`)
        .style('font-size', '10px').style('font-weight', '700').style('fill', '#fef2f2');
    }

    // ── Brush + hover tooltip ─────────────────────────────────────
    attachLineInteractions(g, {
      xS, iw, ih, n,
      domain,
      onZoom:  (d0, d1) => setDomain([d0, d1]),
      onHover: idx => setHoverIdx(idx),
    });

    // ── Hover marker (vertical line + dot + box) ──────────────────
    if (hoverIdx !== null && hoverIdx >= domain[0] && hoverIdx <= domain[1]) {
      const v = dd[hoverIdx];
      drawHoverMarker(g, {
        idx: hoverIdx, xS, ih, iw, n,
        dateLabel: formatDate(indexToDate(hoverIdx, n)),
        series: [{
          value: v,
          y: yS(v),
          color: '#dc2626',
          label: 'BTC drawdown',
          formatted: `${(v * 100).toFixed(1)}%`,
        }],
      });
    }
  }, [dd, maxDrawdown, domain, hoverIdx, n]);

  return html`
    <div class="bg-slate-900 p-6 rounded-3xl shadow-2xl border border-slate-800">
      <div class="mb-4 flex items-center gap-3 flex-wrap">
        <div class="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
          <span class="text-2xl">₿</span>
        </div>
        <div class="min-w-0">
          <h3 class="text-white text-xl font-black">If you went ALL-IN on BTC...</h3>
          <p class="text-slate-400 text-sm">Peak-to-trough drawdown — the silent account killer</p>
        </div>
        <div class="ml-auto flex items-center gap-3">
          ${isZoomed && html`
            <button onClick=${() => setDomain([0, n - 1])}
              class="text-[10px] font-bold text-slate-300 border border-slate-600 hover:border-slate-400 hover:bg-slate-800 rounded-lg px-2.5 py-1 transition-colors">
              ↺ Reset zoom
            </button>`}
          <div class="text-right">
            <div class="text-red-400 text-3xl font-black">${(maxDrawdown * 100).toFixed(0)}%</div>
            <div class="text-slate-500 text-[10px] font-bold uppercase">Worst drawdown</div>
          </div>
        </div>
      </div>

      <svg ref=${ref} style=${{ display: 'block' }} />

      <div class="mt-2 text-[10px] text-slate-500 text-center">
        💡 Drag to zoom into a period · double-click to reset · hover for the date
      </div>

      <div class="mt-4 grid grid-cols-3 gap-3">
        <div class="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <div class="text-red-400 text-xl font-black">−50%</div>
          <div class="text-slate-400 text-[10px]">Half your money gone</div>
        </div>
        <div class="p-3 rounded-xl bg-red-500/20 border border-red-500/30">
          <div class="text-red-300 text-xl font-black">−70%</div>
          <div class="text-slate-400 text-[10px]">A decade of savings — vanished</div>
        </div>
        <div class="p-3 rounded-xl bg-red-500/30 border border-red-500/40">
          <div class="text-red-200 text-xl font-black">−80%+</div>
          <div class="text-slate-400 text-[10px]">Would you still be holding?</div>
        </div>
      </div>
    </div>`;
}
