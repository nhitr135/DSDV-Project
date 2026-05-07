// chartHelpers.js — helpers for line-chart zoom & date tooltips.
// Pure JS (uses global `d3` from CDN). Imported by line-chart components.

// Series cover trading days from 2018-01-01 to 2026-04-22.
// We linearly interpolate index → calendar date. It's an approximation
// (real trading calendar skips weekends/holidays), but visually it's
// indistinguishable for axis labels and hover tooltips.
const SERIES_START = new Date('2018-01-01').getTime();
const SERIES_END   = new Date('2026-04-22').getTime();

export function indexToDate(i, n, start = SERIES_START, end = SERIES_END) {
  if (n <= 1) return new Date(start);
  const t = Math.max(0, Math.min(1, i / (n - 1)));
  return new Date(start + t * (end - start));
}

// Inverse of indexToDate — useful for placing event annotations
// (e.g. "COVID crash on 2020-03-23") at the correct index.
export function dateToIndex(date, n, start = SERIES_START, end = SERIES_END) {
  if (n <= 1) return 0;
  const t = (date.getTime() - start) / (end - start);
  return Math.max(0, Math.min(n - 1, Math.round(t * (n - 1))));
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// "Mar 24, 2020" — for tooltips
export function formatDate(d) {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// "Mar 2020" — for axis tick labels
export function formatMonthYear(d) {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

// "2020" — for compact axis ticks
export function formatYear(d) {
  return `${d.getFullYear()}`;
}

// Pick nice axis ticks given a visible date range.
// Returns an array of { index, label } for the d3 axis.
export function pickTimeTicks(domain0, domain1, n, maxTicks = 8) {
  const d0 = indexToDate(domain0, n);
  const d1 = indexToDate(domain1, n);
  const spanMs   = d1 - d0;
  const spanDays = spanMs / (1000 * 60 * 60 * 24);

  // Choose granularity by visible span
  let unit, step, fmt;
  if (spanDays > 365 * 3) {
    unit = 'year';  step = 1; fmt = formatYear;
  } else if (spanDays > 365) {
    unit = 'month'; step = 6; fmt = formatMonthYear;
  } else if (spanDays > 180) {
    unit = 'month'; step = 2; fmt = formatMonthYear;
  } else if (spanDays > 60) {
    unit = 'month'; step = 1; fmt = formatMonthYear;
  } else if (spanDays > 14) {
    unit = 'week';  step = 1; fmt = formatDate;
  } else {
    unit = 'day';   step = Math.max(1, Math.round(spanDays / maxTicks)); fmt = formatDate;
  }

  // Walk the date range, pick tick dates, then map back to index
  const ticks = [];
  const cursor = new Date(d0);
  // Snap to start of unit
  if (unit === 'year')  { cursor.setMonth(0, 1); cursor.setHours(0,0,0,0); }
  if (unit === 'month') { cursor.setDate(1);     cursor.setHours(0,0,0,0); }
  if (unit === 'week')  { cursor.setDate(cursor.getDate() - cursor.getDay()); cursor.setHours(0,0,0,0); }

  // Step forward until past d1
  while (cursor <= d1 && ticks.length < maxTicks * 3) {
    if (cursor >= d0) {
      const t = (cursor.getTime() - SERIES_START) / (SERIES_END - SERIES_START);
      const idx = Math.round(t * (n - 1));
      if (idx >= domain0 && idx <= domain1) {
        ticks.push({ index: idx, label: fmt(new Date(cursor)) });
      }
    }
    if (unit === 'year')  cursor.setFullYear(cursor.getFullYear() + step);
    if (unit === 'month') cursor.setMonth(cursor.getMonth() + step);
    if (unit === 'week')  cursor.setDate(cursor.getDate() + 7 * step);
    if (unit === 'day')   cursor.setDate(cursor.getDate() + step);
  }

  // Cap ticks; thin them out evenly if too many
  if (ticks.length > maxTicks) {
    const stride = Math.ceil(ticks.length / maxTicks);
    return ticks.filter((_, i) => i % stride === 0);
  }
  return ticks;
}

// ─────────────────────────────────────────────────────────────────
// INTERACTIONS: zoom-brush + hover tooltip
// ─────────────────────────────────────────────────────────────────

/**
 * Attach a click-and-drag brush for zoom selection AND a mouse-tracking
 * overlay for hover tooltips on a line chart.
 *
 * Both behaviours share the same overlay rect — D3's brush owns mousedown
 * (to start a drag-select), but mousemove without active drag is free for
 * us to use for hover. We attach our handler under a custom namespace
 * ('mousemove.zoomTooltip') so it co-exists with d3.brush internals.
 *
 * @param {d3.Selection} g    — the chart inner-group (after margin transform)
 * @param {Object} opts
 *   @param {d3.ScaleLinear} opts.xS
 *   @param {number}    opts.iw           inner width
 *   @param {number}    opts.ih           inner height
 *   @param {number}    opts.n            total data length
 *   @param {[number,number]} opts.domain currently-visible [start, end] indices
 *   @param {function(number, number)} opts.onZoom    called with (d0, d1)
 *   @param {function(number|null)}    opts.onHover   called with index or null
 *   @param {number=}   opts.minZoomSpan  minimum span to commit a zoom (default 7)
 */
export function attachLineInteractions(g, opts) {
  const {
    xS, iw, ih, n, domain,
    onZoom, onHover,
    minZoomSpan = 7,
  } = opts;

  const brush = d3.brushX()
    .extent([[0, 0], [iw, ih]])
    .on('end', (ev) => {
      // Programmatic clears come back with selection === null — ignore
      if (!ev.selection) return;
      const [x0, x1] = ev.selection;
      const i0 = Math.max(domain[0], Math.floor(xS.invert(x0)));
      const i1 = Math.min(domain[1], Math.ceil(xS.invert(x1)));
      // Always clear the visual selection rectangle after deciding
      g.select('.zoom-brush').call(brush.move, null);
      if (i1 - i0 < minZoomSpan) return; // ignore tiny accidental drags
      if (i0 === domain[0] && i1 === domain[1]) return; // no change
      onZoom(i0, i1);
    });

  const brushG = g.append('g').attr('class', 'zoom-brush').call(brush);

  // Style the brush selection rectangle to look intentional
  brushG.selectAll('.selection')
    .style('fill', '#3b82f6').style('fill-opacity', 0.12)
    .style('stroke', '#3b82f6').style('stroke-width', 1);

  // The overlay rect is what catches initial mousedown — reuse for hover.
  const overlay = brushG.select('.overlay');
  overlay.style('cursor', 'crosshair');

  // Hover handler under a custom namespace so we don't clobber d3's
  overlay.on('mousemove.zoomTooltip', function (ev) {
    const [mx] = d3.pointer(ev, this);
    if (mx < 0 || mx > iw) { onHover(null); return; }
    const xVal = xS.invert(mx);
    const idx = Math.max(domain[0], Math.min(domain[1], Math.round(xVal)));
    onHover(idx);
  });
  overlay.on('mouseleave.zoomTooltip', () => onHover(null));

  // Double-click anywhere → reset to full domain
  overlay.on('dblclick.zoomTooltip', () => {
    if (domain[0] !== 0 || domain[1] !== n - 1) onZoom(0, n - 1);
  });
}

/**
 * Render a hover marker (vertical line + dots + tooltip box) at a given
 * data index. Caller draws this inside their useEffect on every render
 * when `hoverIdx !== null`. Returns the appended <g> so caller can
 * attach more or remove it.
 *
 * @param {d3.Selection} g           chart inner-group
 * @param {Object} cfg
 *   @param {number} cfg.idx         the hovered index
 *   @param {d3.ScaleLinear} cfg.xS  x scale
 *   @param {number} cfg.ih          inner height
 *   @param {number} cfg.iw          inner width
 *   @param {number} cfg.n           total data length (for date lookup)
 *   @param {Array<{
 *     value: number,                value at idx for this series
 *     y: number,                    pixel-y at that value (caller computes)
 *     color: string,
 *     label: string,                "ALL-IN", "Diversified", …
 *     formatted: string,            "5.2x", "−42%", …
 *   }>} cfg.series                  one or more series to mark
 *   @param {string=} cfg.dateLabel  pre-formatted date string (caller passes)
 */
export function drawHoverMarker(g, cfg) {
  const { idx, xS, ih, iw, series, dateLabel } = cfg;
  const x = xS(idx);

  const layer = g.append('g').attr('class', 'hover-layer').style('pointer-events', 'none');

  // Vertical guide line
  layer.append('line')
    .attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', ih)
    .style('stroke', '#1e293b').style('stroke-width', 1)
    .style('stroke-dasharray', '3,3').style('opacity', 0.6);

  // Dot per series
  series.forEach(s => {
    layer.append('circle')
      .attr('cx', x).attr('cy', s.y).attr('r', 5)
      .style('fill', s.color).style('stroke', '#fff').style('stroke-width', 2);
  });

  // Tooltip box. Width grows with content; clamp to chart edges.
  const lineH = 14;
  const padX = 10, padY = 8;
  const lines = [dateLabel, ...series.map(s => `${s.label}: ${s.formatted}`)].filter(Boolean);
  const maxChars = Math.max(...lines.map(l => l.length));
  const boxW = Math.min(220, Math.max(110, maxChars * 6.4 + padX * 2));
  const boxH = lines.length * lineH + padY * 2 - 2;

  // Position to the right of the cursor unless near right edge
  let bx = x + 12;
  if (bx + boxW > iw) bx = x - 12 - boxW;
  bx = Math.max(0, Math.min(iw - boxW, bx));
  const by = 8; // anchored near top — looks tidy and stable

  const box = layer.append('g').attr('transform', `translate(${bx},${by})`);
  box.append('rect')
    .attr('width', boxW).attr('height', boxH).attr('rx', 6)
    .style('fill', '#0f172a').style('opacity', 0.92)
    .style('stroke', '#334155').style('stroke-width', 1);

  // Text rows
  if (dateLabel) {
    box.append('text')
      .attr('x', padX).attr('y', padY + 10)
      .text(dateLabel)
      .style('font-size', '11px').style('font-weight', '700').style('fill', '#e2e8f0');
  }
  series.forEach((s, i) => {
    const y0 = padY + 10 + (i + (dateLabel ? 1 : 0)) * lineH;
    // Color swatch
    box.append('rect')
      .attr('x', padX).attr('y', y0 - 7).attr('width', 7).attr('height', 7).attr('rx', 1)
      .style('fill', s.color);
    box.append('text')
      .attr('x', padX + 12).attr('y', y0)
      .text(`${s.label}: ${s.formatted}`)
      .style('font-size', '11px').style('font-weight', '600').style('fill', '#f1f5f9');
  });

  return layer;
}
