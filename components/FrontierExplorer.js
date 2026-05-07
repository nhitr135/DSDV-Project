// components/FrontierExplorer.js
// Full-screen overlay portal for the Efficient Frontier — deep-analysis mode.
//
// Interactions
// ───────────────────────────────────────────────────────────────────
//   1. Filter — by sector OR by individual asset (tabbed).            [Filter]
//   2. Pick a risk level — slider; OR double-click directly on the curve.
//                                                       [Semantic zoom + Focus+Context]
//   3. Select a region — Shift+drag on the chart.       [Linking & brushing]
//   4. Drop notes — double-click empty area; drag pins to reposition. [Annotate]
//   5. Click a dot — pins a tooltip with full composition + "Apply this mix".
//                                                       [Selection / Details on demand]
//   6. Box zoom — Ctrl+drag to zoom into a region.      [Navigation]
//   7. Scroll wheel — zoom in/out at cursor position.   [Navigation]
//   8. Minimap — live mini-chart at top-right showing current viewport.
//                                                       [Coordinate / Overview+Detail]
//
// Design intent
// ─────────────
// All interactions are modifier-driven (Shift, Ctrl, double-click) — no mode
// toggles. Sidebar exposes summaries, not buttons. Pinned tooltips,
// draggable notes, and the minimap mirror conventions from Tableau / Maps,
// so audience is immediately at home.

import { html, useState, useMemo, useEffect, useRef } from '../lib.js';
import {
  drawFrontierChart,
  computeFrontierData,
  annualMetrics,
} from './EfficientFrontier.js';

const NOTES_STORAGE_KEY = 'pp_frontier_notes_v1';

const SECTOR_BUCKETS = {
  Tech:      ['Tech', 'EV/Tech', 'Technology', 'Software', 'AI'],
  Bonds:     ['Bond', 'Bonds', 'Treasury', 'Fixed Income'],
  Crypto:    ['Crypto', 'Cryptocurrency'],
  Commodity: ['Commodity', 'Gold', 'Energy', 'Metals'],
  Equity:    ['ETF', 'Equity', 'Index', 'Stock', 'Consumer', 'Financial', 'Healthcare', 'Industrial', 'REIT', 'Utilities'],
};

function bucketOf(sector) {
  if (!sector) return 'Other';
  for (const [bucket, list] of Object.entries(SECTOR_BUCKETS)) {
    if (list.some(s => s.toLowerCase() === sector.toLowerCase())) return bucket;
  }
  return 'Other';
}

// Chart dims — kept as module constants because we reference them from
// several render paths (main chart, minimap, hit-testing). 1200×600 is the
// "logical" coordinate space; CSS scales it into the available width.
const CHART_W = 1200, CHART_H = 600;
const CHART_MG = { top: 28, right: 32, bottom: 48, left: 64 };
const CHART_IW = CHART_W - CHART_MG.left - CHART_MG.right;
const CHART_IH = CHART_H - CHART_MG.top  - CHART_MG.bottom;

const MINIMAP_W = 180, MINIMAP_H = 110;

export function FrontierExplorer({
  assets, currentWeights, frontierData, userPoint, onApplyWeights, onClose,
}) {
  const ref = useRef(null);
  const minimapRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [pinnedSample, setPinnedSample] = useState(null);

  // ── ① Filter ────────────────────────────────────────────────
  const [filterMode, setFilterMode] = useState('assets');
  const [enabledAssetIds, setEnabledAssetIds] = useState(() =>
    new Set(assets.map(a => a.id)));

  const availableBuckets = useMemo(() => {
    const set = new Set(assets.map(a => bucketOf(a.sector)));
    return [...set];
  }, [assets]);

  const bucketStates = useMemo(() => {
    const out = {};
    availableBuckets.forEach(b => {
      const inB = assets.filter(a => bucketOf(a.sector) === b);
      const onCount = inB.filter(a => enabledAssetIds.has(a.id)).length;
      out[b] = { total: inB.length, on: onCount,
                 state: onCount === 0 ? 'off' : onCount === inB.length ? 'on' : 'partial' };
    });
    return out;
  }, [assets, availableBuckets, enabledAssetIds]);

  const toggleBucket = (b) => {
    const inB = assets.filter(a => bucketOf(a.sector) === b);
    const allOn = inB.every(a => enabledAssetIds.has(a.id));
    setEnabledAssetIds(prev => {
      const next = new Set(prev);
      inB.forEach(a => { if (allOn) next.delete(a.id); else next.add(a.id); });
      return next;
    });
    setBrushedIndices(null);
    setPinnedSample(null);
    setZoomDomain(null);
  };

  const toggleAsset = (id) => {
    setEnabledAssetIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setBrushedIndices(null);
    setPinnedSample(null);
    setZoomDomain(null);
  };

  const filteredAssets = useMemo(() =>
    assets.filter(a => enabledAssetIds.has(a.id)),
    [assets, enabledAssetIds]);

  const filteredData = useMemo(() => {
    if (filteredAssets.length === assets.length) return frontierData;
    if (filteredAssets.length < 2) return null;
    return computeFrontierData(filteredAssets);
  }, [filteredAssets, assets.length, frontierData]);

  const filteredUserPoint = useMemo(() => {
    if (!filteredData) return null;
    if (filteredAssets.length === assets.length) return userPoint;
    const w = filteredAssets.map(a => currentWeights[a.symbol] ?? 0);
    const sw = w.reduce((s, x) => s + x, 0);
    if (sw <= 0) return null;
    const wn = w.map(x => x / sw);
    const m = annualMetrics(filteredData.assetReturns, filteredData.assetMeans, wn);
    return m ? { weights: wn, ...m } : null;
  }, [filteredAssets, assets.length, currentWeights, filteredData, userPoint]);

  // ── ② Risk slider ───────────────────────────────────────────
  const [targetRisk, setTargetRisk] = useState(null);
  const [hasInteractedSlider, setHasInteractedSlider] = useState(false);

  const bestAtRisk = useMemo(() => {
    if (!filteredData || targetRisk == null) return null;
    const tol = 0.02;
    let best = null;
    for (const s of filteredData.samples) {
      if (Math.abs(s.sigmaA - targetRisk) <= tol && (!best || s.sharpe > best.sharpe)) best = s;
    }
    return best;
  }, [filteredData, targetRisk]);

  // ── ③ Brush ─────────────────────────────────────────────────
  const [brushedIndices, setBrushedIndices] = useState(null);

  const brushedSummary = useMemo(() => {
    if (!brushedIndices || !filteredData) return null;
    const pts = brushedIndices.map(i => filteredData.samples[i]).filter(Boolean);
    if (!pts.length) return null;
    const n = filteredAssets.length;
    const avgW = new Array(n).fill(0);
    for (const p of pts) for (let i = 0; i < n; i++) avgW[i] += p.weights[i];
    for (let i = 0; i < n; i++) avgW[i] /= pts.length;
    const composition = avgW
      .map((w, i) => ({ symbol: filteredAssets[i].symbol, w }))
      .sort((a, b) => b.w - a.w);
    const sharpes = pts.map(p => p.sharpe);
    const mus     = pts.map(p => p.muA);
    const sigmas  = pts.map(p => p.sigmaA);
    return {
      count: pts.length, composition,
      sharpeRange: [Math.min(...sharpes), Math.max(...sharpes)],
      muRange:     [Math.min(...mus),     Math.max(...mus)],
      sigmaRange:  [Math.min(...sigmas),  Math.max(...sigmas)],
    };
  }, [brushedIndices, filteredData, filteredAssets]);

  // ── ④ Notes (with drag support) ─────────────────────────────
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem(NOTES_STORAGE_KEY) || '[]'); }
    catch { return []; }
  });
  const [pendingNote, setPendingNote] = useState(null);
  // Track which note is currently being dragged. We update its sigmaA/muA
  // continuously during pointermove so the pin "lives" on the chart.
  const [draggingNote, setDraggingNote] = useState(null); // index | null

  useEffect(() => {
    try { localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes)); }
    catch { /* localStorage may be disabled */ }
  }, [notes]);

  // ── ⑥/⑦ Zoom ────────────────────────────────────────────────
  // null  → full data view (autofit)
  // {xLo, xHi, yLo, yHi} → zoomed
  const [zoomDomain, setZoomDomain] = useState(null);

  // Apply confirmation toast (also used by click-to-pin Apply)
  const [applyConfirm, setApplyConfirm] = useState(null);
  useEffect(() => {
    if (!applyConfirm) return;
    const id = setTimeout(() => setApplyConfirm(null), 3000);
    return () => clearTimeout(id);
  }, [applyConfirm]);

  // ── ESC closes ──────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // ── Apply functions ─────────────────────────────────────────
  const applyWeightsArray = (weightsArr, sample) => {
    // weightsArr aligns with filteredAssets[]. Map back to original assets
    // (non-filtered ones get zero), then commit.
    const totalAmt = assets.reduce((s, a) => s + (a.amount || 0), 0) || 10000;
    const amounts = {};
    const filteredById = new Map(filteredAssets.map((a, i) => [a.id, weightsArr[i]]));
    assets.forEach(a => {
      const w = filteredById.get(a.id) ?? 0;
      amounts[a.id] = totalAmt * w;
    });
    onApplyWeights(amounts);
    if (sample) setApplyConfirm({ sharpe: sample.sharpe, returnA: sample.muA });
  };
  const applyBestAtRisk    = () => bestAtRisk    && applyWeightsArray(bestAtRisk.weights,    bestAtRisk);
  const applyPinnedSample  = () => pinnedSample  && applyWeightsArray(pinnedSample.weights,  pinnedSample);

  // ── Refs to D3 scales for off-chart calculations (notes, minimap) ──
  const xScaleRef = useRef(null);
  const yScaleRef = useRef(null);
  // Full-data domain (used by minimap; doesn't change when zooming)
  const fullDomainRef = useRef(null);

  // ── Main chart render ───────────────────────────────────────
  useEffect(() => {
    if (!ref.current || !filteredData) return;

    // Highlight indices for filter/risk-slider/brush
    let highlightIndices = null;
    if (hasInteractedSlider && targetRisk != null) {
      const tol = 0.02;
      const indices = [];
      filteredData.samples.forEach((s, i) => {
        if (Math.abs(s.sigmaA - targetRisk) <= tol) indices.push(i);
      });
      highlightIndices = indices;
    }
    if (brushedIndices) highlightIndices = brushedIndices;

    // Convert zoomDomain to override format
    const xDomainOverride = zoomDomain ? [zoomDomain.xLo, zoomDomain.xHi] : null;
    const yDomainOverride = zoomDomain ? [zoomDomain.yLo, zoomDomain.yHi] : null;

    const result = drawFrontierChart(ref.current, {
      ...filteredData,
      userPoint: filteredUserPoint,
      animating: false,
      onMarkerClick: null,
      onHover: (h) => {
        // Don't override pinned tooltip on hover
        if (pinnedSample && h && h.index !== undefined) return;
        setHover(h);
      },
      onClick: (h) => {
        if (!h) {
          setPinnedSample(null);
          return;
        }
        // Pin tooltip on the clicked sample
        setPinnedSample(h.sample);
        setHover(null); // hide ephemeral hover when pinning
      },
      width: CHART_W, height: CHART_H,
      highlightIndices,
      xDomainOverride,
      yDomainOverride,
      pinnedSample: pinnedSample || null,
    });
    xScaleRef.current = result.xS;
    yScaleRef.current = result.yS;

    // Stash full-data domain once (used by minimap regardless of zoom state)
    if (!fullDomainRef.current && !zoomDomain) {
      fullDomainRef.current = { xDomain: result.xDomain, yDomain: result.yDomain };
    }

    if (targetRisk == null && filteredUserPoint) {
      setTargetRisk(filteredUserPoint.sigmaA);
    }

    // ── Attach Shift+drag (select), Ctrl+drag (box zoom), and double-click ──
    const svg = d3.select(ref.current);
    const g   = svg.select('g');
    if (g.empty()) return;
    const xS = result.xS, yS = result.yS;

    const overlayRect = g.selectAll('rect')
      .filter(function () { return this.getAttribute('style')?.includes('transparent'); });
    if (overlayRect.empty()) return;
    const overlayNode = overlayRect.node();

    // ───── Custom drag for both Shift (select) and Ctrl (zoom) ─────
    let dragStart = null;
    let dragRectEl = null;
    let dragMode = null; // 'select' | 'zoom'

    const onMouseDown = function (ev) {
      if (ev.shiftKey)      dragMode = 'select';
      else if (ev.ctrlKey)  dragMode = 'zoom';
      else                  return; // plain click is handled by onClick.pin
      ev.preventDefault();
      const [mx, my] = d3.pointer(ev, overlayNode);
      dragStart = { x: mx, y: my };
      dragRectEl = g.append('rect')
        .attr('class', 'shift-brush-rect')
        .attr('x', mx).attr('y', my).attr('width', 0).attr('height', 0)
        .style('fill', dragMode === 'zoom' ? '#10b981' : '#3b82f6')
        .style('fill-opacity', 0.15)
        .style('stroke', dragMode === 'zoom' ? '#10b981' : '#3b82f6')
        .style('stroke-width', 1.5)
        .style('stroke-dasharray', '4,2')
        .style('pointer-events', 'none');
    };
    const onMouseMove = function (ev) {
      if (!dragStart || !dragRectEl) return;
      const [mx, my] = d3.pointer(ev, overlayNode);
      const x0 = Math.min(dragStart.x, mx);
      const y0 = Math.min(dragStart.y, my);
      const w  = Math.abs(mx - dragStart.x);
      const h  = Math.abs(my - dragStart.y);
      dragRectEl.attr('x', x0).attr('y', y0).attr('width', w).attr('height', h);
    };
    const onMouseUp = function () {
      if (!dragStart || !dragRectEl) return;
      const x0 = +dragRectEl.attr('x'), y0 = +dragRectEl.attr('y');
      const w  = +dragRectEl.attr('width'), h = +dragRectEl.attr('height');
      const mode = dragMode;
      dragRectEl.remove();
      dragStart = null; dragRectEl = null; dragMode = null;
      if (w < 4 || h < 4) return; // ignore micro-drags

      const sigmaLo = xS.invert(x0), sigmaHi = xS.invert(x0 + w);
      const muHi    = yS.invert(y0), muLo    = yS.invert(y0 + h);

      if (mode === 'select') {
        const indices = [];
        filteredData.samples.forEach((s, i) => {
          if (s.sigmaA >= sigmaLo && s.sigmaA <= sigmaHi
              && s.muA   >= muLo   && s.muA   <= muHi) indices.push(i);
        });
        setBrushedIndices(indices.length ? indices : null);
      } else if (mode === 'zoom') {
        // Apply box zoom — set zoomDomain to the dragged region
        setZoomDomain({ xLo: sigmaLo, xHi: sigmaHi, yLo: muLo, yHi: muHi });
      }
    };

    overlayRect.on('mousedown.dragselect', onMouseDown);
    overlayRect.on('mousemove.dragselect', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // On Mac, Ctrl+click is treated as right-click and triggers contextmenu
    // BEFORE our mousedown gets the chance to start the drag. Suppress it
    // when Ctrl is held over the chart.
    const onContextMenu = (ev) => {
      if (ev.ctrlKey) ev.preventDefault();
    };
    overlayNode.addEventListener('contextmenu', onContextMenu);

    // ───── Wheel zoom ─────
    // Wheel up → zoom in 10%, centered on cursor (Maps convention).
    // Wheel down → zoom out 10%, centered on cursor.
    // Math: keep cursor's data-coord fixed; new domain is scaled around it.
    const onWheel = (ev) => {
      ev.preventDefault();
      const [mx, my] = d3.pointer(ev, overlayNode);
      // Out-of-bounds wheel events are ignored (e.g. on axis labels)
      if (mx < 0 || mx > CHART_IW || my < 0 || my > CHART_IH) return;
      const factor = ev.deltaY < 0 ? 0.9 : 1.1;
      const cx = xS.invert(mx), cy = yS.invert(my);
      const [xLo, xHi] = xS.domain();
      const [yLo, yHi] = yS.domain();
      const newXLo = cx + (xLo - cx) * factor;
      const newXHi = cx + (xHi - cx) * factor;
      const newYLo = cy + (yLo - cy) * factor;
      const newYHi = cy + (yHi - cy) * factor;
      // Don't zoom out beyond full data; D3 scale jitter at extremes
      const full = fullDomainRef.current;
      if (factor > 1 && full) {
        const fW = full.xDomain[1] - full.xDomain[0];
        const fH = full.yDomain[1] - full.yDomain[0];
        if ((newXHi - newXLo) >= fW * 0.99) {
          setZoomDomain(null);
          return;
        }
      }
      setZoomDomain({ xLo: newXLo, xHi: newXHi, yLo: newYLo, yHi: newYHi });
    };
    overlayNode.addEventListener('wheel', onWheel, { passive: false });

    // ───── Double-click: drop note OR snap risk slider ─────
    overlayRect.on('dblclick.frontier', function (ev) {
      const [mx, my] = d3.pointer(ev, this);
      const sigmaA = xS.invert(mx);
      const muA    = yS.invert(my);
      const closest = filteredData.frontier.length
        ? filteredData.frontier.reduce((b, f) =>
            Math.abs(f.sigmaA - sigmaA) < Math.abs(b.sigmaA - sigmaA) ? f : b,
            filteredData.frontier[0])
        : null;
      const onCurve = closest && Math.abs(closest.muA - muA) < 0.06;
      if (onCurve) {
        setTargetRisk(closest.sigmaA);
        setHasInteractedSlider(true);
      } else {
        setPendingNote({ sigmaA, muA, x: mx, y: my });
      }
    });

    return () => {
      window.removeEventListener('mouseup', onMouseUp);
      overlayNode.removeEventListener('wheel', onWheel);
      overlayNode.removeEventListener('contextmenu', onContextMenu);
    };
  }, [filteredData, filteredUserPoint, brushedIndices, targetRisk,
      hasInteractedSlider, zoomDomain, pinnedSample]);

  // ── Note dragging ───────────────────────────────────────────
  // We use document-level pointermove/pointerup so a drag continues
  // smoothly even if the cursor leaves the chart area.
  useEffect(() => {
    if (draggingNote == null) return;
    const onMove = (ev) => {
      const xS = xScaleRef.current, yS = yScaleRef.current;
      if (!xS || !yS || !ref.current) return;
      // Compute pointer position relative to the SVG inner-group
      const svgRect = ref.current.getBoundingClientRect();
      // SVG uses preserveAspectRatio + viewBox CHART_W × CHART_H. CSS
      // scale ratio is svgRect.width / CHART_W (uniform x/y because
      // xMidYMid meet preserves ratio).
      const scale = svgRect.width / CHART_W;
      const localX = (ev.clientX - svgRect.left) / scale - CHART_MG.left;
      const localY = (ev.clientY - svgRect.top)  / scale - CHART_MG.top;
      // Clamp to inner area so notes can't go outside the chart
      const cx = Math.max(0, Math.min(CHART_IW, localX));
      const cy = Math.max(0, Math.min(CHART_IH, localY));
      const sigmaA = xS.invert(cx);
      const muA    = yS.invert(cy);
      setNotes(prev => prev.map((n, i) =>
        i === draggingNote ? { ...n, sigmaA, muA } : n));
    };
    const onUp = () => setDraggingNote(null);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [draggingNote]);

  // ── Minimap render ──────────────────────────────────────────
  // Tiny SVG showing the FULL cloud + the current viewport rectangle.
  // Click on minimap pans the main view to clicked position (not strictly
  // needed but makes minimap feel interactive — pattern from Plotly).
  useEffect(() => {
    if (!minimapRef.current || !filteredData) return;
    const svgEl = minimapRef.current;
    d3.select(svgEl).selectAll('*').remove();

    const svg = d3.select(svgEl)
      .attr('viewBox', `0 0 ${MINIMAP_W} ${MINIMAP_H}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .style('width', '100%').style('height', '100%');

    // Compute full-data domain (always — even when main chart is zoomed)
    const sigmas = filteredData.samples.map(s => s.sigmaA);
    const mus    = filteredData.samples.map(s => s.muA);
    const xExt = [Math.min(...sigmas), Math.max(...sigmas)];
    const yExt = [Math.min(...mus, 0), Math.max(...mus)];
    const xPad = (xExt[1] - xExt[0]) * 0.05 || 0.01;
    const yPad = (yExt[1] - yExt[0]) * 0.08 || 0.01;
    const xDom = [xExt[0] - xPad, xExt[1] + xPad];
    const yDom = [yExt[0] - yPad, yExt[1] + yPad];

    const pad = 4;
    const xS = d3.scaleLinear().domain(xDom).range([pad, MINIMAP_W - pad]);
    const yS = d3.scaleLinear().domain(yDom).range([MINIMAP_H - pad, pad]);

    // Background
    svg.append('rect').attr('width', MINIMAP_W).attr('height', MINIMAP_H)
      .attr('rx', 4).style('fill', '#f8fafc').style('stroke', '#e2e8f0');

    // Cloud (small grey dots)
    svg.append('g').selectAll('circle')
      .data(filteredData.samples)
      .join('circle')
      .attr('cx', d => xS(d.sigmaA))
      .attr('cy', d => yS(d.muA))
      .attr('r', 0.8)
      .style('fill', '#cbd5e1');

    // Frontier line
    if (filteredData.frontier.length > 1) {
      const ln = d3.line()
        .x(d => xS(d.sigmaA)).y(d => yS(d.muA))
        .curve(d3.curveCatmullRom.alpha(0.5));
      svg.append('path').datum(filteredData.frontier).attr('d', ln)
        .style('fill', 'none').style('stroke', '#2563eb').style('stroke-width', 1);
    }

    // User point
    if (filteredUserPoint) {
      svg.append('circle')
        .attr('cx', xS(filteredUserPoint.sigmaA)).attr('cy', yS(filteredUserPoint.muA))
        .attr('r', 2.5).style('fill', '#dc2626');
    }

    // Viewport rect — shows the zoomed area (or full extent if not zoomed)
    const vp = zoomDomain
      ? { xLo: zoomDomain.xLo, xHi: zoomDomain.xHi, yLo: zoomDomain.yLo, yHi: zoomDomain.yHi }
      : { xLo: xDom[0], xHi: xDom[1], yLo: yDom[0], yHi: yDom[1] };
    svg.append('rect')
      .attr('x', xS(vp.xLo)).attr('y', yS(vp.yHi))
      .attr('width',  Math.max(2, xS(vp.xHi) - xS(vp.xLo)))
      .attr('height', Math.max(2, yS(vp.yLo) - yS(vp.yHi)))
      .style('fill', zoomDomain ? '#3b82f6' : 'none')
      .style('fill-opacity', 0.1)
      .style('stroke', '#3b82f6')
      .style('stroke-width', 1.5);

    // Click on minimap → pan main view to that point (keep zoom factor)
    if (zoomDomain) {
      svg.on('click', function (ev) {
        const [mx, my] = d3.pointer(ev, this);
        const cx = xS.invert(mx), cy = yS.invert(my);
        const halfW = (zoomDomain.xHi - zoomDomain.xLo) / 2;
        const halfH = (zoomDomain.yHi - zoomDomain.yLo) / 2;
        setZoomDomain({
          xLo: cx - halfW, xHi: cx + halfW,
          yLo: cy - halfH, yHi: cy + halfH,
        });
      });
      svg.style('cursor', 'crosshair');
    } else {
      svg.on('click', null);
      svg.style('cursor', 'default');
    }
  }, [filteredData, filteredUserPoint, zoomDomain]);

  const pct = v => `${(v * 100).toFixed(1)}%`;
  const sh  = v => v.toFixed(2);

  // Helper: convert a sample's (sigmaA, muA) to pixel position WITHIN
  // the SVG's CSS box. Used for HTML-overlay tooltip positioning.
  const sampleToOverlayPx = (s) => {
    const xS = xScaleRef.current, yS = yScaleRef.current;
    if (!xS || !yS) return null;
    const svgRect = ref.current?.getBoundingClientRect();
    if (!svgRect) return null;
    const scale = svgRect.width / CHART_W;
    return {
      px: (xS(s.sigmaA) + CHART_MG.left) * scale,
      py: (yS(s.muA)    + CHART_MG.top)  * scale,
      visible: s.sigmaA >= xS.domain()[0] && s.sigmaA <= xS.domain()[1]
            && s.muA    >= yS.domain()[0] && s.muA    <= yS.domain()[1],
    };
  };

  // ─────────────────────────────────────────────────────────────
  return html`
    <div class="fixed inset-0 z-50 flex items-stretch"
      style=${{ background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)' }}>
      <div class="absolute inset-0" onClick=${onClose}></div>

      <div class="relative m-auto w-[96vw] h-[94vh] max-w-[1700px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">

        <!-- Title bar -->
        <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div>
            <div class="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-0.5">
              Frontier Explorer · deep analysis
            </div>
            <h2 class="text-slate-900 text-xl font-black">Find your sweet spot</h2>
          </div>
          <div class="flex items-center gap-3">
            <div class="hidden lg:flex flex-col gap-0.5 text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <div>
                <kbd class="font-mono bg-white border border-slate-300 rounded px-1 text-[9px]">click</kbd> pin ·
                <kbd class="font-mono bg-white border border-slate-300 rounded px-1 text-[9px]">⇧</kbd>+drag select ·
                <kbd class="font-mono bg-white border border-slate-300 rounded px-1 text-[9px]">⌃</kbd>+drag zoom
              </div>
              <div>
                <kbd class="font-mono bg-white border border-slate-300 rounded px-1 text-[9px]">scroll</kbd> zoom ·
                <kbd class="font-mono bg-white border border-slate-300 rounded px-1 text-[9px]">dbl-click</kbd> note/risk
              </div>
            </div>
            <button onClick=${onClose}
              class="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors"
              aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="flex flex-1 min-h-0">

          <!-- Chart area -->
          <div class="flex-1 p-5 relative overflow-auto bg-slate-50/50">
            ${!filteredData
              ? html`
                <div class="h-full flex items-center justify-center">
                  <div class="text-center max-w-sm">
                    <div class="text-3xl mb-2">📭</div>
                    <h3 class="text-slate-700 font-bold mb-1">No portfolios match this filter</h3>
                    <p class="text-slate-500 text-xs">Need at least 2 assets after filtering. Re-enable some assets in the panel.</p>
                  </div>
                </div>`
              : html`
                <svg ref=${ref} style=${{ display: 'block', width: '100%', maxHeight: '100%' }} />

                <!-- Reset zoom button — only when zoomed -->
                ${zoomDomain && html`
                  <button onClick=${() => setZoomDomain(null)}
                    class="absolute top-7 left-7 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 text-[10px] font-bold text-slate-700 flex items-center gap-1 z-10">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M3 12a9 9 0 1 0 9-9" /><polyline points="3 4 3 12 11 12"/>
                    </svg>
                    Reset zoom
                  </button>`}

                <!-- Minimap — top-right corner of chart area -->
                <div class="absolute top-7 right-7 bg-white border border-slate-200 rounded-lg shadow-sm p-1.5"
                  style=${{ width: `${MINIMAP_W + 12}px` }}>
                  <div class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 px-1">
                    ${zoomDomain ? 'Zoomed view · click to pan' : 'Overview'}
                  </div>
                  <svg ref=${minimapRef} style=${{ display: 'block', width: '100%' }} />
                </div>

                <!-- Hover tooltip (only when not pinned) -->
                ${hover && !pinnedSample && html`
                  <div class="absolute pointer-events-none bg-slate-900 text-white rounded-lg px-3 py-2 shadow-xl border border-slate-700"
                    style=${{
                      left: `calc(${(hover.x / CHART_W) * 100}% + 20px)`,
                      top:  `calc(${(hover.y / CHART_H) * 100}% + 20px)`,
                      transform: `translate(${hover.x > 900 ? 'calc(-100% - 40px)' : '0'}, -50%)`,
                      minWidth: '180px', fontSize: '11px', zIndex: 5,
                    }}>
                    <div class="font-black text-amber-300 mb-1">
                      ${pct(hover.sample.muA)} return · ${pct(hover.sample.sigmaA)} risk
                    </div>
                    <div class="text-slate-300 mb-1.5">Reward / Risk: ${sh(hover.sample.sharpe)}</div>
                    <div class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Composition</div>
                    ${hover.sample.weights
                      .map((w, i) => ({ symbol: filteredAssets[i]?.symbol, w }))
                      .filter(c => c.symbol && c.w >= 0.01)
                      .sort((a, b) => b.w - a.w)
                      .slice(0, 5)
                      .map(c => html`
                        <div key=${c.symbol} class="flex justify-between text-[10px] text-slate-200">
                          <span>${c.symbol}</span><span class="font-bold">${(c.w * 100).toFixed(0)}%</span>
                        </div>`)}
                    <div class="text-[9px] text-slate-400 italic mt-1.5 pt-1 border-t border-slate-700">Click to pin →</div>
                  </div>`}

                <!-- Pinned tooltip (persistent, with Apply button) -->
                ${pinnedSample && (() => {
                  const pos = sampleToOverlayPx(pinnedSample);
                  if (!pos || !pos.visible) return null;
                  const svgRect = ref.current?.getBoundingClientRect();
                  if (!svgRect) return null;
                  // Convert px → percentage of chart container
                  const containerLeft = svgRect.left;
                  const containerTop = svgRect.top;
                  const parent = ref.current.parentElement.getBoundingClientRect();
                  const pctLeft = ((containerLeft - parent.left) + pos.px) / parent.width * 100;
                  const pctTop  = ((containerTop  - parent.top)  + pos.py) / parent.height * 100;
                  const flipLeft = pctLeft > 60;
                  return html`
                    <div class="absolute bg-blue-900 text-white rounded-lg px-3 py-2.5 shadow-2xl border-2 border-blue-400"
                      style=${{
                        left: `${pctLeft}%`, top: `${pctTop}%`,
                        transform: `translate(${flipLeft ? 'calc(-100% - 16px)' : '16px'}, -50%)`,
                        minWidth: '220px', fontSize: '11px', zIndex: 7,
                      }}>
                      <div class="flex items-center justify-between mb-1">
                        <div class="text-[9px] font-black text-blue-200 uppercase tracking-widest">Pinned portfolio</div>
                        <button onClick=${() => setPinnedSample(null)}
                          class="text-blue-300 hover:text-white text-base leading-none">×</button>
                      </div>
                      <div class="font-black text-amber-300 mb-1">
                        ${pct(pinnedSample.muA)} return · ${pct(pinnedSample.sigmaA)} risk
                      </div>
                      <div class="text-blue-200 mb-2">Reward / Risk: ${sh(pinnedSample.sharpe)}</div>
                      <div class="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-0.5">Composition</div>
                      <div class="space-y-0.5 mb-2.5">
                        ${pinnedSample.weights
                          .map((w, i) => ({ symbol: filteredAssets[i]?.symbol, w }))
                          .filter(c => c.symbol && c.w >= 0.01)
                          .sort((a, b) => b.w - a.w)
                          .slice(0, 6)
                          .map(c => html`
                            <div key=${c.symbol} class="flex justify-between text-[10px] text-white">
                              <span>${c.symbol}</span>
                              <span class="font-bold">${(c.w * 100).toFixed(0)}%</span>
                            </div>`)}
                      </div>
                      <button onClick=${applyPinnedSample}
                        class="w-full text-[10px] font-black bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-md py-1.5 transition-colors">
                        ⚡ Apply this mix
                      </button>
                    </div>`;
                })()}

                <!-- Notes (draggable) -->
                ${notes.map((note, i) => {
                  const pos = sampleToOverlayPx(note);
                  if (!pos || !pos.visible) return null;
                  const svgRect = ref.current?.getBoundingClientRect();
                  if (!svgRect) return null;
                  const parent = ref.current.parentElement.getBoundingClientRect();
                  const pctLeft = ((svgRect.left - parent.left) + pos.px) / parent.width * 100;
                  const pctTop  = ((svgRect.top  - parent.top)  + pos.py) / parent.height * 100;
                  const isDragging = draggingNote === i;
                  return html`
                    <div key=${i}
                      class="absolute select-none"
                      style=${{
                        left: `${pctLeft}%`, top: `${pctTop}%`,
                        transform: 'translate(-50%, -100%)',
                        zIndex: isDragging ? 20 : 6,
                        cursor: isDragging ? 'grabbing' : 'grab',
                      }}
                      onPointerDown=${(ev) => {
                        // Only left button, ignore if user clicked the × button
                        if (ev.button !== 0) return;
                        if (ev.target.tagName === 'BUTTON') return;
                        ev.stopPropagation();
                        setDraggingNote(i);
                      }}>
                      <div class=${`bg-yellow-100 border ${isDragging ? 'border-blue-500 shadow-2xl' : 'border-yellow-300 shadow-md'} rounded-md px-2 py-1 text-[10px] font-bold text-slate-800 whitespace-nowrap relative group max-w-[180px]`}>
                        📌 ${note.text}
                        <button onClick=${() => setNotes(notes.filter((_, j) => j !== i))}
                          class="ml-1 text-slate-400 hover:text-red-600 font-black opacity-0 group-hover:opacity-100">×</button>
                      </div>
                    </div>`;
                })}

                <!-- Pending note input -->
                ${pendingNote && (() => {
                  const xS = xScaleRef.current, yS = yScaleRef.current;
                  if (!xS || !yS) return null;
                  // pendingNote.x/y are in inner-chart pixels; convert to overlay px
                  const svgRect = ref.current?.getBoundingClientRect();
                  if (!svgRect) return null;
                  const parent = ref.current.parentElement.getBoundingClientRect();
                  const scale = svgRect.width / CHART_W;
                  const px = (pendingNote.x + CHART_MG.left) * scale;
                  const py = (pendingNote.y + CHART_MG.top)  * scale;
                  const pctLeft = ((svgRect.left - parent.left) + px) / parent.width * 100;
                  const pctTop  = ((svgRect.top  - parent.top)  + py) / parent.height * 100;
                  return html`
                    <div class="absolute bg-white border-2 border-blue-500 rounded-lg p-2 shadow-2xl"
                      style=${{
                        left: `calc(${pctLeft}% - 100px)`,
                        top:  `calc(${pctTop}% - 60px)`,
                        zIndex: 30, width: '200px',
                      }}>
                      <input type="text" autoFocus placeholder="Drop a note here..."
                        class="w-full text-xs px-2 py-1 border border-slate-200 rounded outline-none focus:border-blue-500"
                        onKeyDown=${(e) => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            setNotes([...notes, { ...pendingNote, text: e.target.value.trim() }]);
                            setPendingNote(null);
                          }
                          if (e.key === 'Escape') setPendingNote(null);
                        }} />
                      <div class="text-[9px] text-slate-400 mt-1">Press Enter to save · Esc to cancel · drag pin to reposition</div>
                    </div>`;
                })()}

                <!-- Apply confirmation toast -->
                ${applyConfirm && html`
                  <div class="absolute top-3 left-1/2 transform -translate-x-1/2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-500 z-30">
                    <div class="text-[10px] font-black uppercase tracking-widest opacity-80">Mix applied ✓</div>
                    <div class="text-sm font-black">
                      Return ${pct(applyConfirm.returnA)} · Reward/Risk ${sh(applyConfirm.sharpe)}
                    </div>
                    <div class="text-[10px] opacity-80 mt-0.5">
                      Your portfolio updated · keep exploring or close ✕
                    </div>
                  </div>`}
              `}
          </div>

          <!-- Sidebar -->
          <aside class="w-[360px] border-l border-slate-200 bg-white p-5 overflow-y-auto shrink-0 flex flex-col gap-5">

            <!-- ① Filter -->
            <section>
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-700">① Filter</h4>
                ${enabledAssetIds.size < assets.length && html`
                  <button onClick=${() => { setEnabledAssetIds(new Set(assets.map(a => a.id))); setBrushedIndices(null); setPinnedSample(null); setZoomDomain(null); }}
                    class="text-[10px] text-blue-600 hover:underline font-bold">Reset</button>`}
              </div>
              <p class="text-[10px] text-slate-500 mb-2">Choose which assets feed the frontier.</p>
              <div class="flex bg-slate-100 p-0.5 rounded-lg mb-2.5 text-[10px] font-bold">
                <button onClick=${() => setFilterMode('assets')}
                  class=${`flex-1 px-2 py-1 rounded ${filterMode === 'assets' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>By asset</button>
                <button onClick=${() => setFilterMode('sectors')}
                  class=${`flex-1 px-2 py-1 rounded ${filterMode === 'sectors' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>By sector</button>
              </div>
              ${filterMode === 'sectors'
                ? html`
                  <div class="flex flex-wrap gap-1.5">
                    ${availableBuckets.map(b => {
                      const st = bucketStates[b];
                      const cls = st.state === 'on'
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : st.state === 'partial'
                        ? 'bg-blue-50 border-blue-400 text-blue-700'
                        : 'bg-white border-slate-300 text-slate-500 hover:border-slate-500';
                      return html`
                        <button key=${b} onClick=${() => toggleBucket(b)}
                          class=${`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${cls}`}>
                          ${b} <span class="opacity-70">(${st.on}/${st.total})</span>
                        </button>`;
                    })}
                  </div>`
                : html`
                  <div class="grid grid-cols-2 gap-1">
                    ${assets.map(a => {
                      const on = enabledAssetIds.has(a.id);
                      return html`
                        <label key=${a.id}
                          class=${`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold border cursor-pointer transition-all ${
                            on ? 'bg-blue-50 border-blue-200 text-slate-900' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'
                          }`}>
                          <input type="checkbox" checked=${on}
                            onChange=${() => toggleAsset(a.id)}
                            class="w-3 h-3 accent-blue-600" />
                          <span class="w-3 h-3 rounded-sm shrink-0" style=${{ backgroundColor: on ? a.color : '#cbd5e1' }}></span>
                          <span class="truncate">${a.symbol}</span>
                        </label>`;
                    })}
                  </div>`}
              <div class="mt-2 text-[10px] text-slate-500">
                ${enabledAssetIds.size}/${assets.length} assets ·
                ${availableBuckets.filter(b => bucketStates[b].state !== 'off').length} sectors active
              </div>
            </section>

            <!-- ② Risk slider -->
            <section>
              <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-700 mb-2">② Pick a risk level</h4>
              <p class="text-[10px] text-slate-500 mb-2">
                Drag the slider, or double-click directly on the curve.
              </p>
              ${filteredData && filteredData.samples.length && (() => {
                const sigmas = filteredData.samples.map(s => s.sigmaA);
                const lo = Math.min(...sigmas), hi = Math.max(...sigmas);
                return html`
                  <div>
                    <input type="range"
                      min=${lo} max=${hi} step=${(hi - lo) / 100}
                      value=${targetRisk ?? lo}
                      onInput=${(e) => { setTargetRisk(parseFloat(e.target.value)); setHasInteractedSlider(true); }}
                      class="w-full accent-blue-600" />
                    <div class="flex justify-between text-[9px] text-slate-500 font-bold mt-1">
                      <span>${pct(lo)}</span>
                      <span class=${hasInteractedSlider ? 'text-blue-700 text-[11px]' : 'text-slate-400 text-[11px]'}>
                        ${pct(targetRisk ?? lo)}
                      </span>
                      <span>${pct(hi)}</span>
                    </div>
                    ${hasInteractedSlider && bestAtRisk && html`
                      <div class="mt-2.5 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                        <div class="text-[9px] font-black text-blue-700 uppercase tracking-widest mb-1">
                          Best at this risk level
                        </div>
                        <div class="text-[11px] text-slate-700 mb-1.5">
                          Return <span class="font-black">${pct(bestAtRisk.muA)}</span>
                          · Reward/Risk <span class="font-black">${sh(bestAtRisk.sharpe)}</span>
                        </div>
                        <div class="space-y-0.5 mb-2">
                          ${bestAtRisk.weights
                            .map((w, i) => ({ symbol: filteredAssets[i]?.symbol, w }))
                            .filter(c => c.symbol && c.w >= 0.05)
                            .sort((a, b) => b.w - a.w)
                            .slice(0, 4)
                            .map(c => html`
                              <div key=${c.symbol} class="flex justify-between text-[10px]">
                                <span class="text-slate-600">${c.symbol}</span>
                                <span class="font-black text-slate-900">${(c.w * 100).toFixed(0)}%</span>
                              </div>`)}
                        </div>
                        <button onClick=${applyBestAtRisk}
                          class="w-full text-[10px] font-black bg-blue-600 hover:bg-blue-700 text-white rounded-md py-1.5 transition-colors">
                          Apply this mix
                        </button>
                      </div>`}
                    ${!hasInteractedSlider && html`
                      <div class="mt-2 text-[10px] text-slate-400 italic text-center p-2 border border-dashed border-slate-200 rounded-lg">
                        Move the slider to see the best mix
                      </div>`}
                  </div>`;
              })()}
            </section>

            <!-- ③ Selected region -->
            <section>
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-700">③ Selected region</h4>
                ${brushedIndices && html`
                  <button onClick=${() => setBrushedIndices(null)}
                    class="text-[10px] text-blue-600 hover:underline font-bold">Clear</button>`}
              </div>
              <p class="text-[10px] text-slate-500 mb-2">
                Hold <kbd class="font-mono bg-slate-100 border border-slate-300 rounded px-1 text-[9px]">Shift</kbd> and drag a box on the chart.
              </p>
              ${brushedSummary
                ? html`
                  <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div class="text-[10px] text-slate-600 mb-1.5">
                      <span class="font-black text-slate-900">${brushedSummary.count}</span> portfolios selected
                    </div>
                    <div class="space-y-0.5 text-[10px]">
                      <div class="flex justify-between"><span class="text-slate-600">Return range</span><span class="font-black">${pct(brushedSummary.muRange[0])} – ${pct(brushedSummary.muRange[1])}</span></div>
                      <div class="flex justify-between"><span class="text-slate-600">Risk range</span><span class="font-black">${pct(brushedSummary.sigmaRange[0])} – ${pct(brushedSummary.sigmaRange[1])}</span></div>
                      <div class="flex justify-between"><span class="text-slate-600">Reward/Risk</span><span class="font-black">${sh(brushedSummary.sharpeRange[0])} – ${sh(brushedSummary.sharpeRange[1])}</span></div>
                    </div>
                    <div class="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2 mb-1">Avg composition</div>
                    <div class="space-y-0.5">
                      ${brushedSummary.composition.slice(0, 5).map(c => html`
                        <div key=${c.symbol} class="flex items-center gap-1.5 text-[10px]">
                          <span class="text-slate-700 w-12">${c.symbol}</span>
                          <div class="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div class="h-full bg-blue-500" style=${{ width: `${c.w * 100}%` }}></div>
                          </div>
                          <span class="font-black text-slate-900 w-8 text-right">${(c.w * 100).toFixed(0)}%</span>
                        </div>`)}
                    </div>
                  </div>`
                : html`
                  <div class="text-[10px] text-slate-400 italic p-2 border border-dashed border-slate-200 rounded-lg text-center">
                    No region selected
                  </div>`}
            </section>

            <!-- ④ Notes -->
            <section>
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-700">④ Your notes</h4>
                ${notes.length > 0 && html`
                  <button onClick=${() => setNotes([])}
                    class="text-[10px] text-slate-500 hover:text-red-600 font-bold">Clear all</button>`}
              </div>
              <p class="text-[10px] text-slate-500 mb-2">
                Double-click an empty area to drop. Drag any pin to reposition. Saved across sessions.
              </p>
              ${notes.length === 0
                ? html`
                  <div class="text-[10px] text-slate-400 italic p-2 border border-dashed border-slate-200 rounded-lg text-center">
                    No notes yet
                  </div>`
                : html`
                  <div class="space-y-1">
                    ${notes.map((note, i) => html`
                      <div key=${i} class="flex items-start gap-1.5 text-[10px] p-1.5 rounded bg-yellow-50 border border-yellow-200">
                        <span>📌</span>
                        <div class="flex-1 min-w-0">
                          <div class="font-bold text-slate-800 truncate">${note.text}</div>
                          <div class="text-[9px] text-slate-500">at ${pct(note.sigmaA)} risk · ${pct(note.muA)} return</div>
                        </div>
                        <button onClick=${() => setNotes(notes.filter((_, j) => j !== i))}
                          class="text-slate-400 hover:text-red-600 font-black px-1">×</button>
                      </div>`)}
                  </div>`}
            </section>
          </aside>
        </div>
      </div>
    </div>`;
}
