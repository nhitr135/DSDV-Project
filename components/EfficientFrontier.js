// components/EfficientFrontier.js
// Act 5 · STEP 0 — Modern Portfolio Theory in one chart.
//
// What it shows
// ─────────────
// X = annualized risk (σ √252) · Y = annualized return (μ × 252)
//
//   • ~1500 random portfolios drawn from a Dirichlet(1) over the user's
//     selected assets → forms the "feasible region" cloud.
//   • Pareto frontier (efficient frontier).
//   • Capital Market Line (CML).
//   • Three special markers: Min Variance, Max Sharpe (tangency), Max Return.
//   • A pulsing dot for the user's current portfolio. When it's far below
//     the frontier, a dashed guideline points toward the nearest improvement.
//
// What it does
// ────────────
//   • Hover any cloud point → tooltip with stats + composition.
//   • Click any marker → animation: weights interpolate toward that allocation.
//   • "Auto-Optimize" → animate to Max Sharpe + toast showing reward/risk gain.
//   • "Expand" → opens FrontierExplorer overlay with 4 deeper interactions.

import { html, useRef, useEffect, useMemo, useState, useCallback } from '../lib.js';
import { calculatePortfolioRisk } from '../utils.js';
import { FrontierExplorer } from './FrontierExplorer.js';

const TRADING_DAYS = 252;
const RISK_FREE = 0.04;
const N_SAMPLES = 1500;
const SEED = 0x9E3779B1;

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function dirichletSample(n, rand) {
  const w = new Array(n);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const u = Math.max(1e-12, rand());
    w[i] = -Math.log(u);
    s += w[i];
  }
  for (let i = 0; i < n; i++) w[i] /= s;
  return w;
}

function mean(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return arr.length ? s / arr.length : 0;
}

// Defensive metric calc — returns null if inputs are inconsistent.
// This used to silently produce NaN if weights.length didn't match assetMeans.length;
// now it warns + bails so the chart shows the previous valid state instead of
// drawing a dot at NaN/NaN (which D3 silently drops, making the user's marker
// "disappear" — the most-likely cause of the "Auto-Optimize doesn't work after
// adding an asset" report).
export function annualMetrics(assetReturns, assetMeans, weights) {
  if (!Array.isArray(weights) || !Array.isArray(assetMeans) || !Array.isArray(assetReturns)) return null;
  if (weights.length !== assetMeans.length || weights.length !== assetReturns.length) {
    console.warn('[EfficientFrontier] Dimension mismatch:',
      'weights=', weights.length, 'means=', assetMeans.length, 'returns=', assetReturns.length);
    return null;
  }
  let muD = 0;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i], m = assetMeans[i];
    if (!Number.isFinite(w) || !Number.isFinite(m)) return null;
    muD += w * m;
  }
  const sigmaD = calculatePortfolioRisk(assetReturns, weights);
  if (!Number.isFinite(sigmaD)) return null;
  const muA    = muD * TRADING_DAYS;
  const sigmaA = sigmaD * Math.sqrt(TRADING_DAYS);
  const sharpe = sigmaA > 0 ? (muA - RISK_FREE) / sigmaA : 0;
  return { muA, sigmaA, sharpe };
}

function paretoFrontier(samples, nBins = 60) {
  if (!samples.length) return [];
  const sigmas = samples.map(s => s.sigmaA);
  const lo = Math.min(...sigmas), hi = Math.max(...sigmas);
  if (hi === lo) return [];
  const binW = (hi - lo) / nBins;
  const bins = new Array(nBins).fill(null);
  for (const s of samples) {
    const idx = Math.min(nBins - 1, Math.floor((s.sigmaA - lo) / binW));
    if (!bins[idx] || s.muA > bins[idx].muA) bins[idx] = s;
  }
  const upper = bins.filter(Boolean).sort((a, b) => a.sigmaA - b.sigmaA);
  let bestMu = -Infinity;
  const monotone = [];
  for (const p of upper) {
    if (p.muA >= bestMu) { monotone.push(p); bestMu = p.muA; }
  }
  return monotone;
}

// Heavy compute — exported so the Explorer overlay can reuse the same
// random sample (so "the cloud you see in the small chart" stays identical
// to "the cloud you explore in the overlay"). Filtering inside the overlay
// just hides points; it doesn't re-randomize.
export function computeFrontierData(assets) {
  if (assets.length < 2) {
    return { samples: [], frontier: [], minVar: null, maxSharpe: null, maxRet: null, assetReturns: [], assetMeans: [] };
  }
  const assetReturns = assets.map(a => a.returns);
  const assetMeans   = assetReturns.map(r => mean(r));
  const rand = mulberry32(SEED);
  const n = assets.length;

  const samples = [];
  for (let i = 0; i < N_SAMPLES; i++) {
    const w = dirichletSample(n, rand);
    const m = annualMetrics(assetReturns, assetMeans, w);
    if (m) samples.push({ weights: w, ...m });
  }
  // Anchor the cloud edges with single-asset corner portfolios
  for (let i = 0; i < n; i++) {
    const w = new Array(n).fill(0); w[i] = 1;
    const m = annualMetrics(assetReturns, assetMeans, w);
    if (m) samples.push({ weights: w, ...m, _isCorner: true, _cornerIdx: i });
  }

  const frontier  = paretoFrontier(samples);
  const minVar    = frontier.length ? frontier[0] : null;
  const maxRet    = samples.reduce((b, s) => s.muA    > (b?.muA    ?? -Infinity) ? s : b, null);
  const maxSharpe = samples.reduce((b, s) => s.sharpe > (b?.sharpe ?? -Infinity) ? s : b, null);

  return { samples, frontier, minVar, maxSharpe, maxRet, assetReturns, assetMeans };
}

// ───────────────────────────────────────────────────────────────
export function EfficientFrontier({ assets, currentWeights, onApplyWeights }) {
  const ref = useRef(null);

  const assetsKey = useMemo(() =>
    assets.map(a => a.symbol).sort().join(','), [assets]);

  const { samples, frontier, minVar, maxSharpe, maxRet, assetReturns, assetMeans } =
    useMemo(() => computeFrontierData(assets), [assetsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const userPoint = useMemo(() => {
    if (assets.length < 2 || !assetReturns.length) return null;
    const w = assets.map(a => currentWeights[a.symbol] ?? 0);
    const sw = w.reduce((s, x) => s + x, 0);
    if (sw <= 0) return null;
    const wn = w.map(x => x / sw);
    const m  = annualMetrics(assetReturns, assetMeans, wn);
    return m ? { weights: wn, ...m } : null;
  }, [assets, currentWeights, assetReturns, assetMeans]);

  const [animating, setAnimating] = useState(false);
  const [animPt,    setAnimPt]    = useState(null);
  const [toast,     setToast]     = useState(null); // { from, to } sharpe pair
  const [showOverlay, setShowOverlay] = useState(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const animate = useCallback((targetWeights) => {
    if (!userPoint || animating) return;
    if (targetWeights.length !== userPoint.weights.length) {
      console.warn('[EfficientFrontier] animate: target/user weight length mismatch',
        targetWeights.length, userPoint.weights.length);
      return;
    }
    const startW   = userPoint.weights.slice();
    const targetW  = targetWeights.slice();
    const startSharpe = userPoint.sharpe;
    const totalMs  = 1400;
    const startT   = performance.now();
    setAnimating(true);

    const tick = (now) => {
      const t = Math.min(1, (now - startT) / totalMs);
      const e = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
      const wIn = startW.map((s, i) => s + (targetW[i] - s) * e);
      const m = annualMetrics(assetReturns, assetMeans, wIn);
      if (m) setAnimPt({ weights: wIn, ...m });
      if (t < 1) requestAnimationFrame(tick);
      else {
        const finalM = annualMetrics(assetReturns, assetMeans, targetW);
        setAnimating(false);
        setAnimPt(null);
        // Toast: show before/after Sharpe so user sees concrete improvement
        if (finalM) setToast({ from: startSharpe, to: finalM.sharpe });
        // Commit upstream — convert weights → dollar amounts
        const totalAmt = assets.reduce((s, a) => s + (a.amount || 0), 0) || 10000;
        const amounts = {};
        assets.forEach((a, i) => { amounts[a.id] = totalAmt * targetW[i]; });
        onApplyWeights(amounts);
      }
    };
    requestAnimationFrame(tick);
  }, [userPoint, animating, assets, assetReturns, assetMeans, onApplyWeights]);

  const [hover, setHover] = useState(null);

  useEffect(() => {
    if (!ref.current || !samples.length) return;
    drawFrontierChart(ref.current, {
      samples, frontier, minVar, maxSharpe, maxRet,
      userPoint: animPt ?? userPoint,
      animating,
      onMarkerClick: (weights) => animate(weights),
      onHover: setHover,
    });
  }, [samples, frontier, minVar, maxSharpe, maxRet, userPoint, animPt, animating, animate]);

  if (assets.length < 2) {
    return html`
      <div class="bg-white rounded-2xl p-8 border border-slate-200 text-center">
        <h3 class="text-slate-700 font-bold mb-2">Add at least 2 assets</h3>
        <p class="text-slate-500 text-sm">The Efficient Frontier needs multiple assets to find the trade-off curve between risk and return.</p>
      </div>`;
  }

  const pct = v => `${(v * 100).toFixed(1)}%`;
  const sh  = v => v.toFixed(2);

  const hoverComposition = hover && hover.sample
    ? hover.sample.weights
        .map((w, i) => ({ symbol: assets[i].symbol, w }))
        .filter(x => x.w >= 0.01)
        .sort((a, b) => b.w - a.w)
        .slice(0, 4)
    : [];

  // Improvement potential — plain-language friendly
  const sharpeGap = userPoint && maxSharpe ? (maxSharpe.sharpe - userPoint.sharpe) : null;
  const isOptimal = sharpeGap !== null && sharpeGap < 0.05;

  return html`
    <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
      <!-- Header -->
      <div class="flex items-start gap-4 flex-wrap mb-4">
        <div class="flex-1 min-w-[280px]">
          <div class="inline-block px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest mb-2">
            Modern Portfolio Theory · Markowitz 1952
          </div>
          <h3 class="text-slate-900 text-xl font-black">The Efficient Frontier</h3>
          <p class="text-slate-500 text-sm">Every dot is a possible portfolio. The curve is the best you can do.</p>
        </div>
        <div class="flex items-center gap-2">
          <button onClick=${() => setShowOverlay(true)}
            class="px-3 py-2 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
            Expand
          </button>
          <button onClick=${() => maxSharpe && animate(maxSharpe.weights)}
            disabled=${animating || !maxSharpe}
            class=${`px-4 py-2 rounded-xl font-black text-sm transition-all ${
              animating || !maxSharpe
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-600 text-white shadow-md hover:shadow-lg'
            }`}>
            ${animating ? '⚡ Optimizing...' : '⚡ Auto-Optimize'}
          </button>
        </div>
      </div>

      <!-- ── Plain-language metric strip ─────────────────────────── -->
      ${userPoint && maxSharpe && html`
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <!-- Where you are -->
          <div class="p-3 rounded-xl bg-red-50 border border-red-100">
            <div class="text-[9px] font-black text-red-700 uppercase tracking-widest mb-1.5">Where you are</div>
            <div class="space-y-0.5">
              <div class="flex justify-between text-[11px]">
                <span class="text-slate-600">Annual return</span>
                <span class="font-black text-slate-900">${pct(userPoint.muA)}</span>
              </div>
              <div class="flex justify-between text-[11px]">
                <span class="text-slate-600">Annual risk</span>
                <span class="font-black text-slate-900">${pct(userPoint.sigmaA)}</span>
              </div>
              <div class="flex justify-between text-[11px] pt-1 mt-1 border-t border-red-200">
                <span class="text-red-700 font-bold">Reward / Risk</span>
                <span class="font-black text-red-700">${sh(userPoint.sharpe)}</span>
              </div>
            </div>
          </div>

          <!-- Sweet spot -->
          <div class="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <div class="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-1.5">Sweet spot · best mix</div>
            <div class="space-y-0.5">
              <div class="flex justify-between text-[11px]">
                <span class="text-slate-600">Annual return</span>
                <span class="font-black text-slate-900">${pct(maxSharpe.muA)}</span>
              </div>
              <div class="flex justify-between text-[11px]">
                <span class="text-slate-600">Annual risk</span>
                <span class="font-black text-slate-900">${pct(maxSharpe.sigmaA)}</span>
              </div>
              <div class="flex justify-between text-[11px] pt-1 mt-1 border-t border-amber-200">
                <span class="text-amber-700 font-bold">Reward / Risk</span>
                <span class="font-black text-amber-700">${sh(maxSharpe.sharpe)}</span>
              </div>
            </div>
          </div>

          <!-- Improvement potential -->
          <div class=${`p-3 rounded-xl border ${
            isOptimal ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
          }`}>
            <div class=${`text-[9px] font-black uppercase tracking-widest mb-1.5 ${
              isOptimal ? 'text-emerald-700' : 'text-slate-600'
            }`}>
              Improvement potential
            </div>
            ${isOptimal
              ? html`
                <div class="flex items-center gap-2 mt-2">
                  <span class="text-2xl">✓</span>
                  <div>
                    <div class="text-emerald-800 font-black text-sm leading-tight">You're at the sweet spot</div>
                    <div class="text-emerald-700 text-[10px]">No meaningful gain possible</div>
                  </div>
                </div>`
              : html`
                <div class="flex items-baseline gap-2 mt-1">
                  <span class="text-2xl font-black text-slate-900">+${sh(sharpeGap)}</span>
                  <span class="text-[10px] text-slate-500 font-bold">reward / risk</span>
                </div>
                <div class="text-[11px] text-slate-600 mt-1">
                  Same risk, <span class="font-black text-emerald-700">+${pct(maxSharpe.muA - userPoint.muA)}</span> annual return potential
                </div>
                <div class="text-[10px] text-slate-500 italic mt-1">Click Auto-Optimize</div>`}
          </div>
        </div>`}

      <!-- The chart -->
      <div class="relative">
        <svg ref=${ref} style=${{ display: 'block' }} />
        ${hover && html`
          <div class="absolute pointer-events-none bg-slate-900 text-white rounded-lg px-3 py-2 shadow-xl border border-slate-700"
            style=${{
              left: `${(hover.x / 1100) * 100}%`,
              top:  `${(hover.y / 540)  * 100}%`,
              transform: `translate(${hover.x > 800 ? 'calc(-100% - 12px)' : '12px'}, -50%)`,
              minWidth: '180px',
              fontSize: '11px',
              zIndex: 10,
            }}>
            <div class="font-black text-amber-300 mb-1">
              ${pct(hover.sample.muA)} return · ${pct(hover.sample.sigmaA)} risk
            </div>
            <div class="text-slate-300 mb-1.5">Reward / Risk: ${sh(hover.sample.sharpe)}</div>
            <div class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Composition</div>
            ${hoverComposition.map(c => html`
              <div key=${c.symbol} class="flex justify-between text-[10px] text-slate-200">
                <span>${c.symbol}</span><span class="font-bold">${(c.w * 100).toFixed(0)}%</span>
              </div>`)}
          </div>`}

        <!-- Toast: shown briefly after Auto-Optimize completes -->
        ${toast && html`
          <div class="absolute top-3 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-500 z-20">
            <div class="text-[10px] font-black uppercase tracking-widest opacity-80">Optimized ✓</div>
            <div class="text-sm font-black">
              Reward / Risk: ${sh(toast.from)} → ${sh(toast.to)}
              <span class=${`ml-2 ${toast.to > toast.from ? 'text-emerald-200' : 'text-amber-200'}`}>
                (${toast.to >= toast.from ? '+' : ''}${sh(toast.to - toast.from)})
              </span>
            </div>
          </div>`}
      </div>

      <!-- Legend -->
      <div class="mt-3 flex items-center justify-between flex-wrap gap-3 text-[11px] text-slate-600">
        <div class="flex items-center gap-4 flex-wrap">
          <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-slate-300"></span>${N_SAMPLES.toLocaleString()} possible portfolios</span>
          <span class="flex items-center gap-1.5"><span class="w-4 h-1 rounded bg-blue-600"></span>Best-possible curve</span>
          <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-red-600"></span>Your portfolio</span>
        </div>
        <span class="text-slate-400">💡 Click any diamond to apply that mix · click Expand for deeper analysis</span>
      </div>

      <!-- Overlay portal -->
      ${showOverlay && html`
        <${FrontierExplorer}
          assets=${assets}
          currentWeights=${currentWeights}
          frontierData=${{ samples, frontier, minVar, maxSharpe, maxRet, assetReturns, assetMeans }}
          userPoint=${userPoint}
          onApplyWeights=${onApplyWeights}
          onClose=${() => setShowOverlay(false)}
        />`}
    </div>`;
}

// ───────────────────────────────────────────────────────────────
// D3 chart — extracted as a pure render fn so the overlay can reuse it
//
// Optional opts (used by the overlay for box-zoom, minimap, click-to-pin):
//   xDomainOverride, yDomainOverride — force the [lo, hi] domain (else autofit)
//   onClick — called with the nearest sample (or null) on single click
//   pinnedSample — if provided, drawn with an extra ring for emphasis
// ───────────────────────────────────────────────────────────────
export function drawFrontierChart(svgEl, opts) {
  const {
    samples, frontier, minVar, maxSharpe, maxRet,
    userPoint, animating, onMarkerClick, onHover, onClick,
    width = 1100, height = 540,
    highlightIndices = null,
    xDomainOverride = null,
    yDomainOverride = null,
    pinnedSample = null,
  } = opts;

  const W = width, H = height;
  const mg = { top: 28, right: 32, bottom: 48, left: 64 };
  const iw = W - mg.left - mg.right;
  const ih = H - mg.top  - mg.bottom;

  d3.select(svgEl).selectAll('*').remove();
  const svg = d3.select(svgEl)
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('width', '100%');

  const root = svg.append('g').attr('transform', `translate(${mg.left},${mg.top})`);

  // Determine domain — overrides take priority (used by box-zoom in overlay)
  let xDomain, yDomain;
  if (xDomainOverride && yDomainOverride) {
    xDomain = xDomainOverride;
    yDomain = yDomainOverride;
  } else {
    const sigmas = samples.map(s => s.sigmaA);
    const mus    = samples.map(s => s.muA);
    const xExt = [Math.min(...sigmas), Math.max(...sigmas)];
    const yExt = [Math.min(...mus, 0), Math.max(...mus)];
    const xPad = (xExt[1] - xExt[0]) * 0.05 || 0.01;
    const yPad = (yExt[1] - yExt[0]) * 0.08 || 0.01;
    xDomain = [xExt[0] - xPad, xExt[1] + xPad];
    yDomain = [yExt[0] - yPad, yExt[1] + yPad];
  }

  const xS = d3.scaleLinear().domain(xDomain).range([0, iw]);
  const yS = d3.scaleLinear().domain(yDomain).range([ih, 0]);

  // ClipPath so cloud/curve/markers don't render outside the plot area when
  // zoomed in. Without this, scatter dots and the frontier curve would
  // visually overflow the axis box and bleed into margins.
  const clipId = `frontier-clip-${Math.random().toString(36).slice(2, 9)}`;
  svg.append('defs').append('clipPath').attr('id', clipId)
    .append('rect').attr('width', iw).attr('height', ih);
  const clipped = root.append('g').attr('clip-path', `url(#${clipId})`);

  // Grid
  root.append('g').attr('class', 'grid')
    .call(d3.axisLeft(yS).ticks(6).tickSize(-iw).tickFormat(''))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('line').style('stroke', '#e2e8f0').style('stroke-dasharray', '2,3'));
  root.append('g').attr('class', 'grid').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(xS).ticks(6).tickSize(-ih).tickFormat(''))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('line').style('stroke', '#e2e8f0').style('stroke-dasharray', '2,3'));

  // Cloud — drawn into the clipped group so dots outside zoom view disappear
  const isHighlighted = highlightIndices ? new Set(highlightIndices) : null;
  const cloud = clipped.append('g').attr('class', 'cloud');
  cloud.selectAll('circle')
    .data(samples)
    .join('circle')
    .attr('cx', d => xS(d.sigmaA))
    .attr('cy', d => yS(d.muA))
    .attr('r', (d, i) => d._isCorner ? 3 : (isHighlighted?.has(i) ? 2.5 : 2))
    .style('fill', (d, i) => {
      if (d._isCorner) return '#94a3b8';
      if (!isHighlighted) return '#cbd5e1';
      return isHighlighted.has(i) ? '#3b82f6' : '#e2e8f0';
    })
    .style('opacity', (d, i) => {
      if (d._isCorner) return 0.85;
      if (!isHighlighted) return 0.45;
      return isHighlighted.has(i) ? 0.85 : 0.18;
    });

  // Capital Market Line — clipped so the extrapolated tail respects zoom
  if (maxSharpe) {
    const slope = (maxSharpe.muA - RISK_FREE) / maxSharpe.sigmaA;
    // Use the upper end of the visible domain (not the original raw max)
    // so the CML line reaches the right edge cleanly when zoomed.
    const xRight = xDomain[1];
    clipped.append('line')
      .attr('x1', xS(0)).attr('y1', yS(RISK_FREE))
      .attr('x2', xS(xRight)).attr('y2', yS(RISK_FREE + slope * xRight))
      .style('stroke', '#3b82f6').style('stroke-width', 1.5)
      .style('stroke-dasharray', '6,4').style('opacity', 0.55);
    clipped.append('circle').attr('cx', xS(0)).attr('cy', yS(RISK_FREE))
      .attr('r', 3).style('fill', '#3b82f6');
    clipped.append('text').attr('x', xS(0) + 8).attr('y', yS(RISK_FREE) - 6)
      .text(`Risk-free ${(RISK_FREE * 100).toFixed(0)}%`)
      .style('font-size', '10px').style('font-weight', '700').style('fill', '#3b82f6');
  }

  // Frontier curve — clipped
  if (frontier.length > 1) {
    const ln = d3.line()
      .x(d => xS(d.sigmaA)).y(d => yS(d.muA))
      .curve(d3.curveCatmullRom.alpha(0.5));
    clipped.append('path').datum(frontier).attr('d', ln)
      .style('fill', 'none').style('stroke', '#60a5fa')
      .style('stroke-width', 8).style('opacity', 0.18);
    clipped.append('path').datum(frontier).attr('d', ln)
      .style('fill', 'none').style('stroke', '#2563eb')
      .style('stroke-width', 2.5);
  }

  // Markers — only render those visible in current view (avoids labels
  // floating in margins when zoomed). Diamond + label go in `root`, not
  // `clipped`, so labels can extend slightly past the plot edge if needed.
  const markers = [
    { pt: minVar,    color: '#0ea5e9', label: 'Lowest Risk',  sub: 'safest mix' },
    { pt: maxSharpe, color: '#f59e0b', label: 'Sweet Spot',   sub: 'best balance' },
    { pt: maxRet,    color: '#10b981', label: 'Highest Return', sub: 'most aggressive' },
  ].filter(m => m.pt);

  const isInView = (pt) =>
    pt.sigmaA >= xDomain[0] && pt.sigmaA <= xDomain[1] &&
    pt.muA    >= yDomain[0] && pt.muA    <= yDomain[1];

  markers.forEach(m => {
    if (!isInView(m.pt)) return;
    const x = xS(m.pt.sigmaA), y = yS(m.pt.muA);
    root.append('path')
      .attr('transform', `translate(${x},${y}) rotate(45)`)
      .attr('d', 'M -7,-7 L 7,-7 L 7,7 L -7,7 Z')
      .style('fill', m.color).style('stroke', '#fff').style('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', () => onMarkerClick && onMarkerClick(m.pt.weights));
    const badge = root.append('g')
      .attr('transform', `translate(${x + 12}, ${y - 18})`)
      .style('cursor', 'pointer')
      .on('click', () => onMarkerClick && onMarkerClick(m.pt.weights));
    const labelW = m.label.length * 6.4 + 14;
    badge.append('rect').attr('width', labelW).attr('height', 18).attr('rx', 9)
      .style('fill', m.color);
    badge.append('text').attr('x', 7).attr('y', 12)
      .text(m.label).style('font-size', '10px').style('font-weight', '800').style('fill', '#fff');
  });

  // Pinned-sample emphasis ring (drawn before user-point so user-point wins
  // visual priority when overlapping)
  if (pinnedSample && isInView(pinnedSample)) {
    const x = xS(pinnedSample.sigmaA), y = yS(pinnedSample.muA);
    clipped.append('circle')
      .attr('cx', x).attr('cy', y).attr('r', 7)
      .style('fill', 'none').style('stroke', '#3b82f6').style('stroke-width', 2.5);
    clipped.append('circle')
      .attr('cx', x).attr('cy', y).attr('r', 3)
      .style('fill', '#3b82f6');
  }

  // User point — drawn in `clipped` so when zoomed away it disappears
  // gracefully, and ensures the pulsing ring doesn't bleed into margins.
  if (userPoint && isInView(userPoint)) {
    const x = xS(userPoint.sigmaA), y = yS(userPoint.muA);
    const pulse = clipped.append('circle')
      .attr('cx', x).attr('cy', y).attr('r', 8)
      .style('fill', 'none').style('stroke', '#dc2626').style('stroke-width', 2);
    function pulseLoop() {
      pulse.attr('r', 8).style('opacity', 0.9)
        .transition().duration(1200).ease(d3.easeCubicOut)
        .attr('r', 18).style('opacity', 0)
        .on('end', pulseLoop);
    }
    pulseLoop();
    clipped.append('circle')
      .attr('cx', x).attr('cy', y).attr('r', 6)
      .style('fill', '#dc2626').style('stroke', '#fff').style('stroke-width', 2);
    clipped.append('text')
      .attr('x', x + 12).attr('y', y + 4)
      .text('YOU').style('font-size', '10px').style('font-weight', '900').style('fill', '#dc2626');

    if (frontier.length && !animating) {
      const target = frontier.reduce((best, f) =>
        Math.abs(f.sigmaA - userPoint.sigmaA) < Math.abs(best.sigmaA - userPoint.sigmaA) ? f : best, frontier[0]);
      const annualGap = (target.muA - userPoint.muA) * 100;
      if (annualGap > 2) {
        clipped.append('line')
          .attr('x1', x).attr('y1', y)
          .attr('x2', xS(target.sigmaA)).attr('y2', yS(target.muA))
          .style('stroke', '#dc2626').style('stroke-width', 1)
          .style('stroke-dasharray', '3,3').style('opacity', 0.5);
        clipped.append('circle')
          .attr('cx', xS(target.sigmaA)).attr('cy', yS(target.muA))
          .attr('r', 4).style('fill', 'none').style('stroke', '#dc2626').style('stroke-width', 1.5);
      }
    }
  }

  // Axes
  root.append('g').attr('transform', `translate(0,${ih})`)
    .call(d3.axisBottom(xS).ticks(6).tickFormat(d => `${(d * 100).toFixed(0)}%`))
    .call(g => g.select('.domain').style('stroke', '#94a3b8'))
    .call(g => g.selectAll('line').style('stroke', '#94a3b8'))
    .call(g => g.selectAll('text').style('font-size', '10px').style('fill', '#475569').style('font-weight', '600'));
  root.append('g')
    .call(d3.axisLeft(yS).ticks(6).tickFormat(d => `${(d * 100).toFixed(0)}%`))
    .call(g => g.select('.domain').style('stroke', '#94a3b8'))
    .call(g => g.selectAll('line').style('stroke', '#94a3b8'))
    .call(g => g.selectAll('text').style('font-size', '10px').style('fill', '#475569').style('font-weight', '600'));

  root.append('text').attr('x', iw / 2).attr('y', ih + 38).attr('text-anchor', 'middle')
    .text('Annual risk (how much your value swings)')
    .style('font-size', '11px').style('font-weight', '700').style('fill', '#475569');
  root.append('text').attr('transform', `translate(-50, ${ih / 2}) rotate(-90)`).attr('text-anchor', 'middle')
    .text('Annual return (expected gain)')
    .style('font-size', '11px').style('font-weight', '700').style('fill', '#475569');

  // Hover/click overlay — single rect for both. Click does the SAME
  // nearest-neighbour lookup as hover, then forwards to onClick.
  const overlay = root.append('rect')
    .attr('width', iw).attr('height', ih)
    .style('fill', 'transparent').style('cursor', 'crosshair');
  const sx = samples.map(s => xS(s.sigmaA));
  const sy = samples.map(s => yS(s.muA));

  // Find nearest visible (in-domain) sample to a pixel position.
  const findNearest = (mx, my, tolPx = 14) => {
    let bestI = -1, bestD = tolPx * tolPx;
    for (let i = 0; i < samples.length; i++) {
      if (isHighlighted && !isHighlighted.has(i)) continue;
      // Cheap bounds check: skip dots that aren't in view (off-clip)
      if (sx[i] < 0 || sx[i] > iw || sy[i] < 0 || sy[i] > ih) continue;
      const dx = sx[i] - mx, dy = sy[i] - my;
      const d = dx*dx + dy*dy;
      if (d < bestD) { bestD = d; bestI = i; }
    }
    return bestI;
  };

  overlay.on('mousemove', function (ev) {
    const [mx, my] = d3.pointer(ev, this);
    const i = findNearest(mx, my);
    if (i >= 0) onHover && onHover({ sample: samples[i], x: sx[i], y: sy[i], index: i });
    else onHover && onHover(null);
  });
  overlay.on('mouseleave', () => onHover && onHover(null));
  overlay.on('click.pin', function (ev) {
    if (!onClick) return;
    // Ignore clicks that came at the end of a Shift/Ctrl+drag — those are
    // box selections / box-zooms, not pin requests.
    if (ev.shiftKey || ev.ctrlKey || ev.metaKey) return;
    const [mx, my] = d3.pointer(ev, this);
    const i = findNearest(mx, my, 18); // slightly more forgiving on click
    if (i >= 0) onClick({ sample: samples[i], x: sx[i], y: sy[i], index: i });
    else onClick(null);
  });

  return { xS, yS, iw, ih, samples, xDomain, yDomain };
}
