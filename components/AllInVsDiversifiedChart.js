// components/AllInVsDiversifiedChart.js
// Act 3 — Slide 9: "THE BRIDGE"
// The single most important viz in the narrative.
// Line chart comparing ALL-IN (BTC) vs a Diversified portfolio over 8 years,
// with COVID and Crypto Winter annotated directly on the chart.
// Now supports drag-to-zoom + hover tooltip showing both series values.

import { html, useRef, useEffect, useMemo, useState } from '../lib.js';
import { REAL_RETURNS } from '../constants.js';
import {
  returnsToPriceIndex,
  computeDrawdown,
  buildPortfolioReturns,
} from '../utils.js';
import {
  indexToDate,
  dateToIndex,
  formatDate,
  pickTimeTicks,
  attachLineInteractions,
  drawHoverMarker,
} from '../chartHelpers.js';

// Preset diversified portfolio for the narrative
const DIVERSIFIED = [
  { symbol: 'AAPL', weight: 0.20, color: '#60a5fa' },
  { symbol: 'MSFT', weight: 0.15, color: '#34d399' },
  { symbol: 'SPY',  weight: 0.20, color: '#14b8a6' },
  { symbol: 'TLT',  weight: 0.20, color: '#94a3b8' },
  { symbol: 'GOLD', weight: 0.15, color: '#eab308' },
  { symbol: 'BTC',  weight: 0.10, color: '#f59e0b' },
];

// Date-based event positions (more robust than dayPct: chartHelpers handles
// the index lookup for whatever series length we're working with).
// Note: Crypto Winter is marked at the BTC trough (Nov 2022), not the Nov 2021
// peak — that's where the ALL-IN vs Diversified gap is widest, which is the
// narrative point this chart needs to make.
const EVENTS = [
  { date: new Date('2020-03-23'), label: 'COVID Crash',   subLabel: 'Mar 2020 bottom',  color: '#dc2626' },
  { date: new Date('2022-11-21'), label: 'Crypto Winter', subLabel: 'Nov 2022 trough',  color: '#7c3aed' },
];

export function AllInVsDiversifiedChart() {
  const ref = useRef(null);
  const [mode, setMode] = useState('price'); // 'price' | 'drawdown'

  const { allInSeries, divSeries, spySeries, allInDD, divDD, spyDD } = useMemo(() => {
    const btcReturns = REAL_RETURNS.BTC || [];
    const spyReturns = REAL_RETURNS.SPY || [];
    if (!btcReturns.length) return { allInSeries: [], divSeries: [], spySeries: [], allInDD: [], divDD: [], spyDD: [] };

    // Build diversified daily returns from REAL data
    const divAssets = DIVERSIFIED
      .map(d => ({ ...d, returns: REAL_RETURNS[d.symbol] }))
      .filter(d => d.returns?.length);
    // Truncate every series to the shortest length (incl. SPY) so the lines align
    const n = Math.min(
      btcReturns.length,
      spyReturns.length || btcReturns.length,
      ...divAssets.map(d => d.returns.length),
    );
    const divReturns = buildPortfolioReturns(
      divAssets.map(d => d.returns.slice(0, n)),
      divAssets.map(d => d.weight)
    );

    const btcTrunc = btcReturns.slice(0, n);
    const spyTrunc = spyReturns.slice(0, n);
    const allInSeries = returnsToPriceIndex(btcTrunc);
    const divSeries   = returnsToPriceIndex(divReturns);
    const spySeries   = spyTrunc.length ? returnsToPriceIndex(spyTrunc) : [];
    const allInDD     = computeDrawdown(allInSeries);
    const divDD       = computeDrawdown(divSeries);
    const spyDD       = spySeries.length ? computeDrawdown(spySeries) : [];

    return { allInSeries, divSeries, spySeries, allInDD, divDD, spyDD };
  }, []);

  const n = allInSeries.length;

  // Zoom state — persisted across mode toggles
  const [domain, setDomain] = useState([0, 0]);
  const [hoverIdx, setHoverIdx] = useState(null);

  useEffect(() => {
    if (n > 1 && (domain[1] === 0 || domain[1] >= n)) setDomain([0, n - 1]);
  }, [n]);

  const isZoomed = n > 1 && (domain[0] > 0 || domain[1] < n - 1);

  useEffect(() => {
    if (!ref.current || !allInSeries.length || domain[1] === 0) return;
    // Enlarged 860×440 → 1180×600 for clearer detail on dense series.
    // Top margin bumped 30 → 90 so the rich event annotation boxes fit above
    // the plot area without overlapping the data lines. Bottom margin 70
    // keeps event sublabels (e.g. "Nov 2022 trough") below the year ticks.
    const W = 1180, H = 600;
    const mg = { top: 90, right: 140, bottom: 70, left: 60 };
    const iw = W - mg.left - mg.right;
    const ih = H - mg.top - mg.bottom;

    d3.select(ref.current).selectAll('*').remove();
    const svg = d3.select(ref.current)
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('width', '100%');

    const g = svg.append('g').attr('transform', `translate(${mg.left},${mg.top})`);

    const xS = d3.scaleLinear().domain(domain).range([0, iw]);

    // Pick the right series for the active mode
    const allInData = mode === 'price' ? allInSeries : allInDD;
    const divData   = mode === 'price' ? divSeries   : divDD;
    const spyData   = mode === 'price' ? spySeries   : spyDD;
    const hasSpy    = spyData.length > 0;

    // ── Y scale ───────────────────────────────────────────────────
    // Price mode: rescale Y to the visible range (so zoom-in actually shows detail).
    // Drawdown mode: anchor to global min so severity stays felt.
    let yDomain, yFmt, yTitle;
    if (mode === 'price') {
      const sliceA = allInData.slice(domain[0], domain[1] + 1);
      const sliceB = divData.slice(domain[0], domain[1] + 1);
      const sliceC = hasSpy ? spyData.slice(domain[0], domain[1] + 1) : [];
      const lo = Math.min(0, ...sliceA, ...sliceB, ...sliceC);
      const hi = Math.max(...sliceA, ...sliceB, ...sliceC) * 1.05;
      yDomain = [lo, hi];
      yFmt = d => `${(d / 100).toFixed(1)}x`;
      yTitle = 'Value multiple (start = 1x)';
    } else {
      const allDD = hasSpy ? [...allInDD, ...divDD, ...spyDD] : [...allInDD, ...divDD];
      yDomain = [Math.min(...allDD) * 1.02, 0];
      yFmt = d => `${(d * 100).toFixed(0)}%`;
      yTitle = 'Drawdown from peak';
    }
    const yS = d3.scaleLinear().domain(yDomain).range([ih, 0]);

    // ── Grid ──────────────────────────────────────────────────────
    g.append('g').attr('class', 'grid').style('opacity', 0.3)
      .call(d3.axisLeft(yS).ticks(6).tickSize(-iw).tickFormat(''))
      .call(gg => gg.select('.domain').remove())
      .call(gg => gg.selectAll('line').style('stroke', '#cbd5e1').style('stroke-dasharray', '2,2'));

    // ── Event annotations — only show when their index lies in the visible domain ──
    // Each event renders a vertical guide line + an annotation box above the chart
    // showing BOTH series' values at that moment (key narrative payoff per docx Slide 9).
    EVENTS.forEach(ev => {
      const idx = dateToIndex(ev.date, n);
      if (idx < domain[0] || idx > domain[1]) return;
      const xPos = xS(idx);

      // Vertical guide line through full plot
      g.append('line')
        .attr('x1', xPos).attr('x2', xPos).attr('y1', 0).attr('y2', ih)
        .style('stroke', ev.color).style('stroke-width', 1.5)
        .style('stroke-dasharray', '5,4').style('opacity', 0.5);

      // Values at this index — what the docx actually wants on screen
      const allInVal = allInData[idx];
      const divVal   = divData[idx];
      const spyVal   = hasSpy ? spyData[idx] : null;

      // Annotation box dimensions + position (clamped within chart width).
      // Box height grows when SPY benchmark is also shown.
      const boxW = 200;
      const boxH = hasSpy ? 80 : 62;
      let bx = xPos - boxW / 2;
      if (bx < 4) bx = 4;
      if (bx + boxW > iw - 4) bx = iw - boxW - 4;
      const by = -boxH - 8; // sits in the top margin we reserved (mg.top = 90)

      // Connector line from box bottom to the chart top edge at the event x.
      // Anchors to the closest visible point if the box was clamped.
      const connectorX = Math.max(bx + 14, Math.min(bx + boxW - 14, xPos));
      g.append('line')
        .attr('x1', connectorX).attr('y1', by + boxH)
        .attr('x2', xPos).attr('y2', 0)
        .style('stroke', ev.color).style('stroke-width', 1)
        .style('stroke-dasharray', '2,2').style('opacity', 0.55);

      const box = g.append('g').attr('transform', `translate(${bx},${by})`);

      // Card with subtle drop-shadow + colored border matching the event
      box.append('rect')
        .attr('width', boxW).attr('height', boxH).attr('rx', 8)
        .style('fill', '#ffffff')
        .style('stroke', ev.color).style('stroke-width', 1.5)
        .style('filter', 'drop-shadow(0 2px 3px rgba(15,23,42,0.10))');

      // Header row: event name (left) + date (right)
      box.append('text')
        .attr('x', 12).attr('y', 15)
        .text(ev.label)
        .style('font-size', '10px').style('font-weight', '900')
        .style('fill', ev.color).style('text-transform', 'uppercase')
        .style('letter-spacing', '0.04em');
      box.append('text')
        .attr('x', boxW - 12).attr('y', 15).attr('text-anchor', 'end')
        .text(formatDate(ev.date))
        .style('font-size', '9px').style('font-weight', '700').style('fill', '#94a3b8');

      // Subtle divider between header and value rows
      box.append('line')
        .attr('x1', 12).attr('x2', boxW - 12).attr('y1', 22).attr('y2', 22)
        .style('stroke', '#e2e8f0').style('stroke-width', 1);

      // Helper to render one value row: dot + label + tabular value
      const addRow = (yRow, dotColor, txtColor, label, value) => {
        box.append('circle').attr('cx', 16).attr('cy', yRow - 3).attr('r', 3.5).style('fill', dotColor);
        box.append('text')
          .attr('x', 25).attr('y', yRow)
          .text(label)
          .style('font-size', '10px').style('font-weight', '800').style('fill', txtColor);
        box.append('text')
          .attr('x', boxW - 12).attr('y', yRow).attr('text-anchor', 'end')
          .text(yFmt(value))
          .style('font-size', '12px').style('font-weight', '900').style('fill', txtColor)
          .style('font-variant-numeric', 'tabular-nums');
      };

      // ALL-IN row (red), Diversified row (green), and optional SPY row (slate).
      // Order chosen to put the dramatic comparison up top.
      addRow(36, '#ef4444', '#dc2626', 'ALL-IN',     allInVal);
      addRow(52, '#10b981', '#047857', 'Diversified', divVal);
      if (hasSpy) addRow(68, '#64748b', '#475569', 'SPY 100%', spyVal);

      // Sublabel below x-axis — gives temporal context to the event line
      g.append('text')
        .attr('x', xPos).attr('y', ih + 38).attr('text-anchor', 'middle')
        .text(ev.subLabel).style('font-size', '9px').style('fill', ev.color).style('font-weight', '700');
    });

    // ── Lines, clipped to visible domain ──────────────────────────
    const visibleA = [];
    const visibleB = [];
    const visibleC = [];
    for (let i = domain[0]; i <= domain[1]; i++) {
      visibleA.push({ i, v: allInData[i] });
      visibleB.push({ i, v: divData[i] });
      if (hasSpy) visibleC.push({ i, v: spyData[i] });
    }
    const lineGen = d3.line().x(d => xS(d.i)).y(d => yS(d.v)).curve(d3.curveMonotoneX);

    // SPY first (under), then Diversified, then ALL-IN on top.
    // SPY drawn slightly thinner + dashed so it reads as "passive benchmark"
    // rather than competing with the active comparison.
    if (hasSpy) {
      g.append('path').datum(visibleC).attr('d', lineGen)
        .style('fill', 'none').style('stroke', '#64748b').style('stroke-width', 2)
        .style('stroke-dasharray', '6,3').style('opacity', 0.85);
    }
    g.append('path').datum(visibleB).attr('d', lineGen)
      .style('fill', 'none').style('stroke', '#10b981').style('stroke-width', 2.5);
    g.append('path').datum(visibleA).attr('d', lineGen)
      .style('fill', 'none').style('stroke', '#ef4444').style('stroke-width', 2.5);

    // ── End-of-visible markers + labels ───────────────────────────
    const endIdx = domain[1];
    g.append('circle').attr('cx', xS(endIdx)).attr('cy', yS(allInData[endIdx])).attr('r', 4).style('fill', '#ef4444');
    g.append('circle').attr('cx', xS(endIdx)).attr('cy', yS(divData[endIdx])).attr('r', 4).style('fill', '#10b981');
    if (hasSpy) g.append('circle').attr('cx', xS(endIdx)).attr('cy', yS(spyData[endIdx])).attr('r', 3.5).style('fill', '#64748b');
    g.append('text')
      .attr('x', xS(endIdx) + 8).attr('y', yS(allInData[endIdx])).attr('dy', '.35em')
      .text(`ALL-IN: ${yFmt(allInData[endIdx])}`)
      .style('font-size', '11px').style('font-weight', '900').style('fill', '#ef4444');
    g.append('text')
      .attr('x', xS(endIdx) + 8).attr('y', yS(divData[endIdx])).attr('dy', '.35em')
      .text(`Diversified: ${yFmt(divData[endIdx])}`)
      .style('font-size', '11px').style('font-weight', '900').style('fill', '#10b981');
    if (hasSpy) {
      g.append('text')
        .attr('x', xS(endIdx) + 8).attr('y', yS(spyData[endIdx])).attr('dy', '.35em')
        .text(`SPY: ${yFmt(spyData[endIdx])}`)
        .style('font-size', '10px').style('font-weight', '800').style('fill', '#64748b');
    }

    // ── Axes ──────────────────────────────────────────────────────
    g.append('g')
      .call(d3.axisLeft(yS).ticks(6).tickFormat(yFmt))
      .call(gg => gg.select('.domain').remove())
      .call(gg => gg.selectAll('line').style('stroke', '#e2e8f0'))
      .call(gg => gg.selectAll('text').style('font-size', '10px').style('fill', '#64748b').style('font-weight', '600'));

    const ticks = pickTimeTicks(domain[0], domain[1], n, 8);
    g.append('g').attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(xS).tickValues(ticks.map(t => t.index))
        .tickFormat((d, i) => ticks[i]?.label ?? ''))
      .call(gg => gg.select('.domain').remove())
      .call(gg => gg.selectAll('line').style('stroke', '#e2e8f0'))
      .call(gg => gg.selectAll('text').style('font-size', '10px').style('fill', '#64748b').style('font-weight', '600'));

    g.append('text')
      .attr('transform', `translate(-44,${ih / 2}) rotate(-90)`).attr('text-anchor', 'middle')
      .text(yTitle).style('font-size', '10px').style('font-weight', '700').style('fill', '#64748b');

    // ── Brush + hover ─────────────────────────────────────────────
    attachLineInteractions(g, {
      xS, iw, ih, n,
      domain,
      onZoom:  (d0, d1) => setDomain([d0, d1]),
      onHover: idx => setHoverIdx(idx),
    });

    // ── Hover marker ──────────────────────────────────────────────
    if (hoverIdx !== null && hoverIdx >= domain[0] && hoverIdx <= domain[1]) {
      const a = allInData[hoverIdx];
      const b = divData[hoverIdx];
      const c = hasSpy ? spyData[hoverIdx] : null;
      const series = [
        { value: a, y: yS(a), color: '#ef4444', label: 'ALL-IN',      formatted: yFmt(a) },
        { value: b, y: yS(b), color: '#10b981', label: 'Diversified', formatted: yFmt(b) },
      ];
      if (hasSpy) series.push(
        { value: c, y: yS(c), color: '#64748b', label: 'SPY 100%',    formatted: yFmt(c) }
      );
      drawHoverMarker(g, {
        idx: hoverIdx, xS, ih, iw, n,
        dateLabel: formatDate(indexToDate(hoverIdx, n)),
        series,
      });
    }
  }, [mode, allInSeries, divSeries, spySeries, allInDD, divDD, spyDD, domain, hoverIdx, n]);

  if (!allInSeries.length) return null;

  const allInEnd  = allInSeries[allInSeries.length - 1];
  const divEnd    = divSeries[divSeries.length - 1];
  const spyEnd    = spySeries.length ? spySeries[spySeries.length - 1] : null;
  const allInMaxDD = Math.min(...allInDD);
  const divMaxDD   = Math.min(...divDD);
  const spyMaxDD   = spyDD.length ? Math.min(...spyDD) : null;
  const hasSpy     = spySeries.length > 0;

  return html`
    <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
      <div class="flex items-start gap-4 mb-4 flex-wrap">
        <div class="flex-1 min-w-[300px]">
          <div class="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest mb-2">
            The Bridge
          </div>
          <h3 class="text-slate-900 text-xl font-black">
            ALL-IN BTC vs a Diversified Mix
          </h3>
          <p class="text-slate-500 text-sm">Same 8 years. Same market. Completely different ride.</p>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          ${isZoomed && html`
            <button onClick=${() => setDomain([0, n - 1])}
              class="text-[10px] font-bold text-slate-600 border border-slate-300 hover:bg-slate-100 rounded-lg px-2.5 py-1.5 transition-colors">
              ↺ Reset zoom
            </button>`}
          <!-- Mode toggle -->
          <div class="flex bg-slate-100 p-1 rounded-xl">
            <button onClick=${() => setMode('price')}
              class=${`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mode === 'price' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'
              }`}>Growth</button>
            <button onClick=${() => setMode('drawdown')}
              class=${`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mode === 'drawdown' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'
              }`}>Drawdown</button>
          </div>
        </div>
      </div>

      <svg ref=${ref} style=${{ display: 'block' }} />

      <div class="mt-2 text-[10px] text-slate-500 text-center">
        💡 Drag any horizontal range to zoom · double-click to reset · hover to see the date
      </div>

      <!-- Side-by-side stats — 3 cards when SPY is present, otherwise 2 -->
      <div class=${`mt-5 grid gap-4 ${hasSpy ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-2'}`}>
        <div class="p-4 rounded-2xl border border-red-200 bg-red-50">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-3 h-3 rounded-full bg-red-500"></div>
            <span class="text-red-700 text-[10px] font-black uppercase tracking-widest">ALL-IN Bitcoin</span>
          </div>
          <div class="grid grid-cols-2 gap-3 mt-3">
            <div>
              <div class="text-red-900 text-xl font-black">${(allInEnd / 100).toFixed(1)}x</div>
              <div class="text-red-700 text-[10px] font-bold">Final value</div>
            </div>
            <div>
              <div class="text-red-900 text-xl font-black">${(allInMaxDD * 100).toFixed(0)}%</div>
              <div class="text-red-700 text-[10px] font-bold">Max drawdown</div>
            </div>
          </div>
          <div class="mt-3 text-[11px] text-red-800 italic">"Could you hold through a ${Math.abs(allInMaxDD * 100).toFixed(0)}% drop?"</div>
        </div>

        <div class="p-4 rounded-2xl border border-emerald-200 bg-emerald-50">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span class="text-emerald-700 text-[10px] font-black uppercase tracking-widest">Diversified Mix</span>
          </div>
          <div class="grid grid-cols-2 gap-3 mt-3">
            <div>
              <div class="text-emerald-900 text-xl font-black">${(divEnd / 100).toFixed(1)}x</div>
              <div class="text-emerald-700 text-[10px] font-bold">Final value</div>
            </div>
            <div>
              <div class="text-emerald-900 text-xl font-black">${(divMaxDD * 100).toFixed(0)}%</div>
              <div class="text-emerald-700 text-[10px] font-bold">Max drawdown</div>
            </div>
          </div>
          <div class="mt-3 text-[11px] text-emerald-800 italic">"Smoother ride. Smaller pain. You actually hold."</div>
        </div>

        ${hasSpy && html`
          <div class="p-4 rounded-2xl border border-slate-300 bg-slate-50">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-3 h-3 rounded-full bg-slate-500"></div>
              <span class="text-slate-700 text-[10px] font-black uppercase tracking-widest">SPY 100% (passive)</span>
            </div>
            <div class="grid grid-cols-2 gap-3 mt-3">
              <div>
                <div class="text-slate-900 text-xl font-black">${(spyEnd / 100).toFixed(1)}x</div>
                <div class="text-slate-600 text-[10px] font-bold">Final value</div>
              </div>
              <div>
                <div class="text-slate-900 text-xl font-black">${(spyMaxDD * 100).toFixed(0)}%</div>
                <div class="text-slate-600 text-[10px] font-bold">Max drawdown</div>
              </div>
            </div>
            <div class="mt-3 text-[11px] text-slate-600 italic">"What 99% of retail just buys. Not bad — but not balanced."</div>
          </div>`}
      </div>

      <!-- Composition note -->
      <div class="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
        <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Diversified mix:</span>
        <span class="text-[11px] text-slate-700 font-semibold ml-2">
          ${DIVERSIFIED.map(d => `${(d.weight * 100).toFixed(0)}% ${d.symbol}`).join(' · ')}
        </span>
        ${hasSpy && html`
          <div class="mt-2 pt-2 border-t border-slate-200 flex items-center gap-2 text-[10px] text-slate-500">
            <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#64748b" stroke-width="2" stroke-dasharray="4,2"/></svg>
            <span><span class="font-black">SPY 100%</span> shown as a passive benchmark — what most retail investors actually own.</span>
          </div>`}
      </div>

      <!-- Key lesson -->
      <div class="mt-3 p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-center">
        <p class="text-white text-sm font-bold italic">
          ${hasSpy
            ? '"ALL-IN climbs faster but falls hardest. Passive SPY is fine. Active diversification wins the drawdown."'
            : '"ALL-IN climbs faster — but falls harder."'}
        </p>
        <p class="text-slate-300 text-xs mt-1">
          Diversification loses the peak, but it wins the one thing that matters: survival.
        </p>
      </div>
    </div>`;
}
