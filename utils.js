// utils.js — pure calculation helpers, no React dependency

export function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}

export function calculateStandardDeviation(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

export function calculateCorrelation(a, b) {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let num = 0, denomA = 0, denomB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA, db = b[i] - meanB;
    num += da * db; denomA += da * da; denomB += db * db;
  }
  const denom = Math.sqrt(denomA * denomB);
  return denom === 0 ? 0 : num / denom;
}

// Full covariance-matrix portfolio risk
export function calculatePortfolioRisk(assetReturns, weights) {
  const n = assetReturns.length;
  if (n === 0) return 0;
  const stds = assetReturns.map(r => calculateStandardDeviation(r));
  let variance = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const corr = i === j ? 1 : calculateCorrelation(assetReturns[i], assetReturns[j]);
      variance += weights[i] * weights[j] * stds[i] * stds[j] * corr;
    }
  }
  return Math.sqrt(Math.max(0, variance));
}

/**
 * Diversification score 0-100, calibrated to real-world correlation ranges.
 *
 * Maps the typical avgCorr range [+0.85, -0.10] linearly onto [0, 100] with
 * clipping. Hedge-rich portfolios saturate at 100; sector-concentrated
 * portfolios saturate at 0.
 *
 * Calibration anchors (avgCorr → score):
 *   +0.85 →   0   (5 FAANG-style — behaves like one bet)
 *   +0.50 →  37   (mostly equities, one sector)
 *   +0.20 →  68   (multi-sector equity + one hedge)
 *    0.00 →  89   (genuinely uncorrelated mix)
 *   −0.10 → 100   (active hedging present)
 *
 * The previous formula `((1 - avgCorr) / 2) * 100` mapped the FULL theoretical
 * [-1, +1] correlation range. But real-asset correlations cluster between 0.2
 * and 0.7, so all real portfolios produced scores in 15-45 — making A/B/C/D
 * grading effectively show only C/D. New formula uses realistic anchors so
 * the four grades are all reachable with the project's 15-asset catalog.
 *
 * Negative correlations (hedges) still push score HIGHER, preserving the
 * docx narrative that "BTC ↔ GOLD = good" is rewarded above "everything ~0".
 */
export function computeDiversificationScore(assets) {
  if (assets.length < 2) return 100;
  const pairs = [];
  for (let i = 0; i < assets.length; i++)
    for (let j = i + 1; j < assets.length; j++)
      pairs.push(calculateCorrelation(assets[i].returns, assets[j].returns));
  const avgCorr = pairs.reduce((s, r) => s + r, 0) / pairs.length;

  const WORST_CORR = 0.85;   // 5-FAANG floor
  const BEST_CORR  = -0.10;  // genuine hedge ceiling
  const raw = (WORST_CORR - avgCorr) / (WORST_CORR - BEST_CORR);
  return Math.round(Math.max(0, Math.min(1, raw)) * 100);
}

// Convert a series of daily returns into a cumulative price index (starting at 100)
export function returnsToPriceIndex(returns, start = 100) {
  const prices = [start];
  for (let i = 0; i < returns.length; i++) {
    prices.push(prices[prices.length - 1] * (1 + returns[i]));
  }
  return prices;
}

// Compute drawdown series from a price index: max peak-to-current drop, negative
export function computeDrawdown(priceIndex) {
  const dd = [];
  let peak = priceIndex[0];
  for (let i = 0; i < priceIndex.length; i++) {
    if (priceIndex[i] > peak) peak = priceIndex[i];
    dd.push(priceIndex[i] / peak - 1); // negative or zero
  }
  return dd;
}

// Build a weighted-portfolio returns series from asset returns + weights
// Returns an array of daily portfolio returns (same length as shortest asset series)
export function buildPortfolioReturns(assetReturns, weights) {
  const n = Math.min(...assetReturns.map(r => r.length));
  const totalW = weights.reduce((s, w) => s + w, 0) || 1;
  const w = weights.map(x => x / totalW);
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let a = 0; a < assetReturns.length; a++) {
      r += w[a] * (assetReturns[a][i] || 0);
    }
    out[i] = r;
  }
  return out;
}

/**
 * Risk contribution per asset using Euler / component-VaR decomposition.
 *
 * For a portfolio P = Σ w_i · R_i:
 *   var(P) = Σ_i w_i · cov(R_i, P)
 *
 * This identity (Euler's theorem on homogeneous functions) means each asset's
 * contribution to TOTAL portfolio variance is `w_i · cov(R_i, P)`, and these
 * contributions sum EXACTLY to var(P). Normalizing by var(P) gives a signed
 * fraction summing to 100%.
 *
 * Critically — unlike the old "remove-and-measure" approach which clamped
 * negative contributions to 0 — this method correctly returns NEGATIVE
 * contributions for genuine hedges (assets whose covariance with the
 * portfolio is negative). A natural hedge like TLT in a tech-heavy mix
 * shows up as e.g. −8%, accurately reflecting that it REDUCES portfolio risk.
 *
 * @param {Array<{ returns: number[] }>} assets
 * @param {number[]} weights — should sum to 1 (will be normalized if not)
 * @returns {Array<{ contribution: number, pct: number }>} where:
 *   contribution = signed fraction of variance (Σ = 1.0)
 *   pct          = same value rounded to 1 decimal, expressed as %
 */
export function computeRiskContributions(assets, weights) {
  const n = assets.length;
  if (n === 0) return [];

  const totalW = weights.reduce((s, w) => s + w, 0) || 1;
  const w = weights.map(x => x / totalW);

  const dailyN = Math.min(...assets.map(a => a.returns.length));
  if (dailyN === 0) return assets.map(() => ({ contribution: 0, pct: 0 }));

  // Build portfolio return series
  const portfolioRet = new Array(dailyN).fill(0);
  for (let t = 0; t < dailyN; t++) {
    let r = 0;
    for (let i = 0; i < n; i++) r += w[i] * (assets[i].returns[t] || 0);
    portfolioRet[t] = r;
  }
  const meanP = portfolioRet.reduce((s, r) => s + r, 0) / dailyN;
  let varP = 0;
  for (let t = 0; t < dailyN; t++) varP += (portfolioRet[t] - meanP) ** 2;
  varP /= dailyN;
  if (varP === 0) return assets.map(() => ({ contribution: 0, pct: 0 }));

  // For each asset: contribution = w_i · cov(R_i, R_p) / var(R_p)
  return assets.map((a, i) => {
    const ret = a.returns;
    let meanA = 0;
    for (let t = 0; t < dailyN; t++) meanA += (ret[t] || 0);
    meanA /= dailyN;
    let cov = 0;
    for (let t = 0; t < dailyN; t++) {
      cov += ((ret[t] || 0) - meanA) * (portfolioRet[t] - meanP);
    }
    cov /= dailyN;
    const contribution = w[i] * cov / varP;
    return { contribution, pct: contribution * 100 };
  });
}

/**
 * Historical 95% Value-at-Risk for a portfolio.
 *
 * Returns the threshold daily loss such that 95% of historical days were
 * better than this number. In plain English: "on the worst 5% of days, the
 * portfolio lost AT LEAST this much."
 *
 * Sign convention: returns a NEGATIVE number (a loss). e.g. -0.04 means
 * "5% tail starts at a -4% day."
 *
 * @param {Array<{ returns: number[] }>} assets
 * @param {number[]} weights
 * @returns {number} 5th-percentile daily portfolio return
 */
export function compute95VaR(assets, weights) {
  if (assets.length === 0) return 0;
  const totalW = weights.reduce((s, w) => s + w, 0) || 1;
  const w = weights.map(x => x / totalW);

  const dailyN = Math.min(...assets.map(a => a.returns.length));
  if (dailyN === 0) return 0;

  const portRet = new Array(dailyN);
  for (let t = 0; t < dailyN; t++) {
    let r = 0;
    for (let i = 0; i < assets.length; i++) r += w[i] * (assets[i].returns[t] || 0);
    portRet[t] = r;
  }
  const sorted = [...portRet].sort((a, b) => a - b);
  const idx = Math.floor(0.05 * sorted.length);
  return sorted[idx] ?? 0;
}

// Plain-English narrative for a correlation value
export function getCorrelationInsight(symbolA, symbolB, r) {
  const upDays = Math.round((0.5 + Math.abs(r) * 0.5) * 10);
  if (symbolA === symbolB) return 'This is the same asset — perfect correlation by definition.';
  if (r > 0.8)  return `Out of every 10 days ${symbolA} rises, ${symbolB} rises roughly ${upDays} of those days too. They behave almost like the same bet — holding both gives you less protection than you might think.`;
  if (r > 0.5)  return `${symbolA} and ${symbolB} tend to rise and fall together. In a market downturn, both are likely to drop at the same time — they won't protect each other much.`;
  if (r > 0.2)  return `${symbolA} and ${symbolB} have a mild tendency to move in the same direction, but they also diverge frequently. You get partial — not full — diversification from holding both.`;
  if (r > -0.2) return `${symbolA} and ${symbolB} move mostly independently — they respond to different market forces. This is exactly what good diversification looks like.`;
  if (r > -0.5) return `${symbolA} and ${symbolB} sometimes move in opposite directions, giving your portfolio a small cushion when markets get volatile.`;
  return `${symbolA} and ${symbolB} often move in opposite directions — when one falls, the other tends to rise. This is a natural hedge and one of the most valuable combinations in a portfolio.`;
}

export function generatePortfolioInsights(assets) {
  const insights = [];
  if (assets.length < 2) return ['Add more assets to unlock portfolio insights.'];
  const totalWeight = assets.reduce((s, a) => s + a.weight, 0) || 1;
  const normalizedWeights = assets.map(a => a.weight / totalWeight);
  const maxWeight = Math.max(...normalizedWeights);
  if (maxWeight > 0.5) {
    const heaviest = assets[normalizedWeights.indexOf(maxWeight)];
    insights.push(`⚠️ ${heaviest.symbol} makes up over 50% of your portfolio — consider rebalancing.`);
  }
  let totalCorr = 0, pairs = 0;
  for (let i = 0; i < assets.length; i++)
    for (let j = i + 1; j < assets.length; j++) {
      totalCorr += calculateCorrelation(assets[i].returns, assets[j].returns);
      pairs++;
    }
  const avgCorr = pairs > 0 ? totalCorr / pairs : 0;
  if (avgCorr > 0.75)     insights.push('🔴 Assets are highly correlated — your portfolio may not be well-diversified.');
  else if (avgCorr > 0.5) insights.push('🟡 Moderate correlation detected. Some diversification benefit exists.');
  else if (avgCorr > 0)   insights.push('🟢 Low average correlation — your portfolio benefits from strong diversification.');
  else                    insights.push('💎 Negative average correlation — you have natural hedges that protect against downturns.');
  const vols = assets.map(a => calculateStandardDeviation(a.returns));
  const maxVol = Math.max(...vols);
  const highVolAsset = assets[vols.indexOf(maxVol)];
  if (maxVol > 0.025)
    insights.push(`📊 ${highVolAsset.symbol} is the most volatile asset (daily σ ≈ ${(maxVol * 100).toFixed(1)}%).`);
  return insights;
}

// Mulberry32 — deterministic seeded PRNG
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function generateMockReturns(drift, volatility, days, symbol) {
  const seed = symbol
    ? symbol.split('').reduce((s, c) => s + c.charCodeAt(0), 0) * 1000
    : 42000;
  const rand = mulberry32(seed);
  const returns = [];
  let price = 100;
  for (let i = 0; i < days; i++) {
    const dailyReturn = drift + volatility * (rand() - 0.5) * 2;
    price *= (1 + dailyReturn);
    returns.push(dailyReturn);
  }
  return returns;
}

export function generateAdvisorInsights(assets, totalAmount, risk) {
  if (totalAmount === 0) {
    return [{ type: 'neutral', icon: '💡', title: 'Enter Your Amounts', body: 'Input dollar amounts for each asset above to receive personalized portfolio analysis.', action: null }];
  }
  const insights = [];
  const sorted = [...assets].sort((a, b) => b.weight - a.weight);
  const top = sorted[0];
  const top2w = (sorted[0]?.weight || 0) + (sorted[1]?.weight || 0);

  if (top && top.weight > 0.4) {
    insights.push({ type: 'warning', icon: '⚠️', title: 'High Concentration', body: `${top.symbol} makes up ${(top.weight * 100).toFixed(0)}% of your portfolio — nearly half your capital. A single bad earnings report or sector shock could significantly damage your returns.`, action: `Consider trimming ${top.symbol} to below 25% and redistributing into uncorrelated assets.` });
  } else if (top2w > 0.65) {
    insights.push({ type: 'warning', icon: '⚠️', title: 'Top-Heavy Portfolio', body: `Your top 2 holdings (${sorted[0]?.symbol} + ${sorted[1]?.symbol}) control ${(top2w * 100).toFixed(0)}% of your portfolio.`, action: `Aim for no single asset exceeding 30% and top 2 below 50%.` });
  } else {
    insights.push({ type: 'good', icon: '✅', title: 'Balanced Concentration', body: `Your largest position (${top?.symbol} at ${(top?.weight * 100).toFixed(0)}%) is well-controlled. No single asset dominates your portfolio.`, action: null });
  }

  const sectors = assets.reduce((acc, a) => { acc[a.sector || 'Other'] = (acc[a.sector || 'Other'] || 0) + a.weight; return acc; }, {});
  const sectorEntries = Object.entries(sectors).sort((a, b) => b[1] - a[1]);
  const dominantSector = sectorEntries[0];
  const sectorCount = sectorEntries.length;
  if (dominantSector && dominantSector[1] > 0.6) {
    insights.push({ type: 'warning', icon: '🏭', title: 'Sector Concentration', body: `${(dominantSector[1] * 100).toFixed(0)}% of your portfolio is in ${dominantSector[0]} — a single sector event could hit most of your assets simultaneously.`, action: `Diversify into other sectors: ${['Bond', 'REIT', 'Energy', 'Commodity'].filter(s => !sectors[s]).slice(0, 2).join(', ') || 'consider defensive sectors'}.` });
  } else if (sectorCount >= 3) {
    insights.push({ type: 'good', icon: '🌐', title: 'Good Sector Spread', body: `Your portfolio spans ${sectorCount} sectors (${sectorEntries.slice(0, 3).map(([s, w]) => `${s} ${(w * 100).toFixed(0)}%`).join(', ')}). This reduces exposure to any single industry cycle.`, action: null });
  } else {
    insights.push({ type: 'neutral', icon: '📊', title: 'Limited Sector Diversity', body: `You're invested in ${sectorCount} sector${sectorCount > 1 ? 's' : ''} (${sectorEntries.map(([s, w]) => `${s} ${(w * 100).toFixed(0)}%`).join(', ')}).`, action: `Consider adding exposure to bonds (TLT) or commodities (GOLD) as portfolio stabilizers.` });
  }

  const annualVol = risk * Math.sqrt(252) * 100;
  // Thresholds match VOL_THRESHOLD in constants.js (HIGH=30%, LOW=15%) — the
  // same boundaries RiskMeter and RiskRadar use, so labels stay consistent.
  if (annualVol >= 30) {
    insights.push({ type: 'warning', icon: '🔥', title: 'High Portfolio Volatility', body: `Your estimated annualized volatility is ${annualVol.toFixed(0)}% — well above the S&P 500's historical ~15%. In a bad year, your portfolio could realistically drop ${(annualVol * 0.7).toFixed(0)}–${(annualVol * 1.2).toFixed(0)}%.`, action: `Adding low-volatility assets like TLT (bonds) or GOLD could dampen swings without sacrificing all upside.` });
  } else if (annualVol < 15) {
    insights.push({ type: 'good', icon: '🛡️', title: 'Low Volatility Portfolio', body: `Annualized volatility of ${annualVol.toFixed(0)}% is conservative — your portfolio should hold up well during moderate market stress.`, action: null });
  } else {
    insights.push({ type: 'neutral', icon: '⚖️', title: 'Moderate Volatility', body: `Annualized volatility of ${annualVol.toFixed(0)}% is in line with a typical balanced portfolio.`, action: `Monitor correlation between your top holdings — if they become more correlated over time, your effective risk may increase.` });
  }

  const cryptos = assets.filter(a => a.sector === 'Crypto');
  const cryptoW = cryptos.reduce((s, a) => s + a.weight, 0);
  if (cryptoW > 0.3) {
    insights.push({ type: 'warning', icon: '₿', title: 'Heavy Crypto Exposure', body: `${(cryptoW * 100).toFixed(0)}% in crypto (${cryptos.map(a => a.symbol).join(', ')}) adds extreme volatility — crypto has historically drawn down 50–80% in bear markets.`, action: `Most financial advisors suggest capping crypto at 5–15% of a portfolio for risk management.` });
  }

  return insights.slice(0, 4);
}
