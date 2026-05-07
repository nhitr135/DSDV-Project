// components/AllInHallOfPain.js
// Act 2 — Slide 4.5: "You think BTC is the worst? It's not."
//
// Layout:
//   1. Header — title + lead
//   2. Summary bar — 4 horizontal bars (one per asset) at the top so the
//      "wall of evidence" impression registers in one glance
//   3. Tabs — TSLA · NVDA · META · ETH, click to swap the big chart
//   4. Big drawdown chart for the active asset (~same size as BTCDrawdownChart,
//      with zoom + hover tooltip + max-drawdown annotation)
//   5. Punchline — "ALL-IN isn't a crypto problem — it's an ALL-IN problem."

import { html, useRef, useEffect, useMemo, useState } from '../lib.js';
import { REAL_RETURNS, CATALOG_MAP } from '../constants.js';
import { returnsToPriceIndex, computeDrawdown } from '../utils.js';
import {
  indexToDate,
  formatDate,
  pickTimeTicks,
  attachLineInteractions,
  drawHoverMarker,
} from '../chartHelpers.js';

const HALL_OF_PAIN_ASSETS = ['TSLA', 'NVDA', 'META', 'ETH'];

const HEADLINES = {
  TSLA: '"The next Apple"',
  NVDA: 'AI revolution darling',
  META: 'Blue-chip social media',
  ETH:  '"Future of finance"',
};

// ─────────────────────────────────────────────────────────────────
// Per-asset stats (drawdown series + peak/trough indices)
// ─────────────────────────────────────────────────────────────────
function computeAssetStats(symbol) {
  const returns = REAL_RETURNS[symbol] || [];
  if (!returns.length) return { dd: [], maxDD: 0, peakIdx: 0, troughIdx: 0, n: 0 };
  const prices = returnsToPriceIndex(returns);
  const dd = computeDrawdown(prices);
  const troughIdx = dd.indexOf(Math.min(...dd));
  let peakIdx = 0, peakP = prices[0];
  for (let i = 0; i <= troughIdx; i++) {
    if (prices[i] > peakP) { peakP = prices[i]; peakIdx = i; }
  }
  return { dd, maxDD: dd[troughIdx], peakIdx, troughIdx, n: dd.length };
}

// ─────────────────────────────────────────────────────────────────
// Big drawdown chart for ONE asset (zoom + tooltip, mirrors BTC chart)
// ─────────────────────────────────────────────────────────────────
function AssetDrawdownChart({ symbol, color, headline, stats }) {
  const ref = useRef(null);
  const { dd, maxDD, peakIdx, troughIdx, n } = stats;

  const [domain, setDomain]     = useState([0, 0]);
  const [hoverIdx, setHoverIdx] = useState(null);

  // Reset zoom + hover whenever the active symbol changes
  useEffect(() => {
    if (n > 1) setDomain([0, n - 1]);
    setHoverIdx(null);
  }, [symbol, n]);

  const isZoomed = n > 1 && (domain[0] > 0 || domain[1] < n - 1);

  useEffect(() => {
    if (!ref.current || !dd.length || domain[1] === 0) return;
    const W = 1100, H = 460;
    const mg = { top: 30, right: 110, bottom: 50, left: 60 };
    const iw = W - mg.left - mg.right;
    const ih = H - mg.top - mg.bottom;

    d3.select(ref.current).selectAll('*').remove();
    const svg = d3.select(ref.current)
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('width', '100%');

    const g = svg.append('g').attr('transform', `translate(${mg.left},${mg.top})`);

    const xS = d3.scaleLinear().domain(domain).range([0, iw]);
    const yS = d3.scaleLinear()
      .domain([Math.min(-0.9, maxDD - 0.02), 0])
      .range([ih, 0]);

    // Danger zones at -50% / -70% (universal threshold for all assets)
    const zones = [
      { y0: -0.5, y1: -0.7, color: '#fef3c7' },
      { y0: -0.7, y1: -0.9, color: '#fecaca' },
    ];
    zones.forEach(z => {
      g.append('rect')
        .attr('x', 0).attr('y', yS(z.y0))
        .attr('width', iw).attr('height', yS(z.y1) - yS(z.y0))
        .style('fill', z.color).style('opacity', 0.3);
    });

    [-0.5, -0.7].forEach(t => {
      g.append('line')
        .attr('x1', 0).attr('x2', iw).attr('y1', yS(t)).attr('y2', yS(t))
        .style('stroke', '#ef4444').style('stroke-width', 1)
        .style('stroke-dasharray', '4,3').style('opacity', 0.5);
      g.append('text')
        .attr('x', iw + 8).attr('y', yS(t)).attr('dy', '.35em')
        .text(`${(t * 100).toFixed(0)}%`)
        .style('font-size', '11px').style('font-weight', '800').style('fill', '#dc2626');
    });

    // Filled drawdown area (clipped to visible domain)
    const visible = dd
      .map((v, i) => ({ i, v }))
      .filter(d => d.i >= domain[0] && d.i <= domain[1]);

    const gradId = `hop-grad-${symbol}`;
    const defs = svg.append('defs');
    const grad = defs.append('linearGradient').attr('id', gradId)
      .attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#fca5a5').attr('stop-opacity', 0.4);
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#dc2626').attr('stop-opacity', 0.85);

    const area = d3.area()
      .x(d => xS(d.i)).y0(yS(0)).y1(d => yS(d.v))
      .curve(d3.curveMonotoneX);
    g.append('path').datum(visible).attr('d', area).style('fill', `url(#${gradId})`);

    const line = d3.line()
      .x(d => xS(d.i)).y(d => yS(d.v))
      .curve(d3.curveMonotoneX);
    g.append('path').datum(visible).attr('d', line)
      .style('fill', 'none').style('stroke', '#b91c1c').style('stroke-width', 2);

    // Y-axis
    g.append('g')
      .call(d3.axisLeft(yS).ticks(5).tickFormat(d => `${(d * 100).toFixed(0)}%`))
      .call(gg => gg.select('.domain').remove())
      .call(gg => gg.selectAll('line').style('stroke', '#334155'))
      .call(gg => gg.selectAll('text').style('font-size', '10px').style('fill', '#94a3b8').style('font-weight', '600'));

    // X-axis with smart time ticks
    const ticks = pickTimeTicks(domain[0], domain[1], n, 8);
    g.append('g').attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(xS).tickValues(ticks.map(t => t.index))
        .tickFormat((d, i) => ticks[i]?.label ?? ''))
      .call(gg => gg.select('.domain').remove())
      .call(gg => gg.selectAll('line').style('stroke', '#334155'))
      .call(gg => gg.selectAll('text').style('font-size', '10px').style('fill', '#94a3b8').style('font-weight', '600'));

    // Max drawdown annotation (only when visible)
    if (troughIdx >= domain[0] && troughIdx <= domain[1]) {
      g.append('circle')
        .attr('cx', xS(troughIdx)).attr('cy', yS(maxDD))
        .attr('r', 6).style('fill', '#dc2626').style('stroke', '#fff').style('stroke-width', 2);

      const annX = Math.min(xS(troughIdx), iw - 200);
      const annY = yS(maxDD) - 20;
      g.append('rect')
        .attr('x', annX + 8).attr('y', annY - 32)
        .attr('width', 190).attr('height', 50).attr('rx', 6)
        .style('fill', '#7f1d1d').style('stroke', '#dc2626').style('stroke-width', 1);
      g.append('text')
        .attr('x', annX + 16).attr('y', annY - 16)
        .text(`${symbol} max drawdown: ${(maxDD * 100).toFixed(0)}%`)
        .style('font-size', '12px').style('font-weight', '900').style('fill', '#fff');
      g.append('text')
        .attr('x', annX + 16).attr('y', annY - 2)
        .text(formatDate(indexToDate(troughIdx, n)))
        .style('font-size', '10px').style('fill', '#fca5a5');
      g.append('text')
        .attr('x', annX + 16).attr('y', annY + 12)
        .text(`$100K → $${Math.round(100 * (1 + maxDD))}K`)
        .style('font-size', '10px').style('font-weight', '700').style('fill', '#fef2f2');
    }

    // Brush + hover
    attachLineInteractions(g, {
      xS, iw, ih, n,
      domain,
      onZoom:  (d0, d1) => setDomain([d0, d1]),
      onHover: idx => setHoverIdx(idx),
    });

    // Hover marker
    if (hoverIdx !== null && hoverIdx >= domain[0] && hoverIdx <= domain[1]) {
      const v = dd[hoverIdx];
      drawHoverMarker(g, {
        idx: hoverIdx, xS, ih, iw, n,
        dateLabel: formatDate(indexToDate(hoverIdx, n)),
        series: [{
          value: v, y: yS(v), color: '#dc2626',
          label: `${symbol} drawdown`, formatted: `${(v * 100).toFixed(1)}%`,
        }],
      });
    }
  }, [dd, maxDD, peakIdx, troughIdx, n, domain, hoverIdx, symbol]);

  if (!dd.length) return null;

  return html`
    <div>
      <div class="flex items-center gap-3 mb-3 flex-wrap">
        <div class="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black text-white shrink-0"
          style=${{ backgroundColor: color }}>${symbol[0]}</div>
        <div class="min-w-0">
          <h4 class="text-white text-lg font-black leading-tight">If you went ALL-IN on ${symbol}...</h4>
          <p class="text-slate-400 text-xs italic">${headline}</p>
        </div>
        <div class="ml-auto flex items-center gap-3">
          ${isZoomed && html`
            <button onClick=${() => setDomain([0, n - 1])}
              class="text-[10px] font-bold text-slate-300 border border-slate-600 hover:border-slate-400 hover:bg-slate-800 rounded-lg px-2.5 py-1 transition-colors">
              ↺ Reset zoom
            </button>`}
          <div class="text-right">
            <div class="text-red-400 text-3xl font-black leading-none">${(maxDD * 100).toFixed(0)}%</div>
            <div class="text-slate-500 text-[9px] font-bold uppercase tracking-wide">Worst drawdown</div>
          </div>
        </div>
      </div>
      <svg ref=${ref} style=${{ display: 'block' }} />
      <div class="mt-2 text-[10px] text-slate-500 text-center">
        💡 Drag to zoom · double-click to reset · hover for date + drawdown
      </div>
      <div class="text-[10px] text-slate-500 text-center mt-1">
        Peak ${formatDate(indexToDate(peakIdx, n))} → trough ${formatDate(indexToDate(troughIdx, n))}
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────────────────────────
export function AllInHallOfPain() {
  const [activeSym, setActiveSym] = useState('TSLA');

  // Compute stats for ALL 4 assets once. Used by:
  //   1. Summary bar (max DD per asset, all visible at-a-glance)
  //   2. Tab buttons (max DD label)
  //   3. The active chart
  const allStats = useMemo(() => {
    const out = {};
    HALL_OF_PAIN_ASSETS.forEach(sym => { out[sym] = computeAssetStats(sym); });
    return out;
  }, []);

  // Sort summary bar by severity (worst first) for impact
  const summaryOrder = [...HALL_OF_PAIN_ASSETS].sort((a, b) => allStats[a].maxDD - allStats[b].maxDD);
  const worstMax = Math.min(...HALL_OF_PAIN_ASSETS.map(s => allStats[s].maxDD));

  const activeMeta  = CATALOG_MAP[activeSym];
  const activeStats = allStats[activeSym];

  return html`
    <div class="bg-slate-900 p-6 rounded-3xl shadow-2xl border border-slate-800">
      <div class="text-center mb-5 max-w-2xl mx-auto">
        <div class="inline-block px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-[10px] font-black uppercase tracking-widest mb-3">
          But maybe BTC is special?
        </div>
        <h3 class="text-white text-2xl md:text-3xl font-black leading-tight">
          You think BTC is the worst?
          <span class="text-red-400">It's not.</span>
        </h3>
        <p class="text-slate-400 text-sm mt-2">
          Same era. Different "sure-thing" assets. Same brutal lesson.
        </p>
      </div>

      <!-- ── Summary bar — wall of evidence at a glance ─────────── -->
      <div class="mb-5 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
        <div class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">
          Worst drawdowns 2018–2026 · ranked
        </div>
        <div class="space-y-2">
          ${summaryOrder.map(sym => {
            const s    = allStats[sym];
            const pct  = Math.abs(s.maxDD / worstMax) * 100;
            const isActive = sym === activeSym;
            return html`
              <button key=${sym} onClick=${() => setActiveSym(sym)}
                class=${`w-full flex items-center gap-3 group ${isActive ? '' : 'opacity-80 hover:opacity-100'}`}>
                <span class="text-white font-bold text-xs w-12 text-left">${sym}</span>
                <div class="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div class=${`h-full rounded-full transition-all ${isActive ? '' : 'group-hover:opacity-90'}`}
                    style=${{
                      width: `${pct}%`,
                      background: isActive
                        ? 'linear-gradient(90deg, #fca5a5, #dc2626)'
                        : 'linear-gradient(90deg, #b91c1c, #7f1d1d)',
                    }}></div>
                </div>
                <span class=${`font-black text-sm w-14 text-right ${isActive ? 'text-red-300' : 'text-slate-400'}`}>
                  ${(s.maxDD * 100).toFixed(0)}%
                </span>
              </button>`;
          })}
        </div>
      </div>

      <!-- ── Tab buttons ─────────────────────────────────────────── -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        ${HALL_OF_PAIN_ASSETS.map(sym => {
          const s    = allStats[sym];
          const isActive = sym === activeSym;
          return html`
            <button key=${sym} onClick=${() => setActiveSym(sym)}
              class=${`p-3 rounded-xl border text-left transition-all ${
                isActive
                  ? 'bg-red-600 border-red-500 shadow-lg shadow-red-500/20'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600 hover:bg-slate-800/80'
              }`}>
              <div class="flex items-baseline justify-between gap-2">
                <span class=${`font-black text-base ${isActive ? 'text-white' : 'text-slate-200'}`}>${sym}</span>
                <span class=${`font-black text-sm ${isActive ? 'text-white/90' : 'text-red-400'}`}>
                  ${(s.maxDD * 100).toFixed(0)}%
                </span>
              </div>
              <div class=${`text-[10px] truncate mt-0.5 ${isActive ? 'text-white/70' : 'text-slate-500'}`}>
                ${HEADLINES[sym]}
              </div>
            </button>`;
        })}
      </div>

      <!-- ── Big drawdown chart for active asset ─────────────────── -->
      <div class="bg-slate-950/40 rounded-2xl p-4 border border-slate-800">
        <${AssetDrawdownChart}
          key=${activeSym}
          symbol=${activeSym}
          color=${activeMeta?.color || '#dc2626'}
          headline=${HEADLINES[activeSym]}
          stats=${activeStats} />
      </div>

      <!-- ── Punchline ───────────────────────────────────────────── -->
      <div class="mt-5 p-4 rounded-2xl bg-gradient-to-r from-red-950 to-slate-950 border border-red-900/40 text-center">
        <p class="text-white text-base md:text-xl font-black italic leading-tight">
          "ALL-IN isn't a <span class="text-red-400">crypto</span> problem —
          <br class="hidden sm:block" />
          it's an <span class="underline decoration-red-500">ALL-IN</span> problem."
        </p>
        <p class="text-slate-400 text-[11px] mt-2 max-w-md mx-auto">
          Tech stocks, AI darlings, "the next Apple" — they all crashed 60–80% when
          sentiment turned. The asset doesn't matter. The strategy does.
        </p>
      </div>
    </div>`;
}
