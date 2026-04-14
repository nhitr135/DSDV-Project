import { Asset } from './constants.ts';

// ─── Tailwind-style class merger ──────────────────────────────────────────────
export function cn(...inputs: Array<string | number | null | undefined | boolean>) {
  return inputs.filter(Boolean).join(' ');
}

// ─── Standard deviation of an array ─────────────────────────────────────────
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

// ─── Pearson correlation between two return series ───────────────────────────
export function calculateCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;

  const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;

  let num = 0, denomA = 0, denomB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denomA += da * da;
    denomB += db * db;
  }

  const denom = Math.sqrt(denomA * denomB);
  return denom === 0 ? 0 : num / denom;
}

// ─── Portfolio volatility (daily) ────────────────────────────────────────────
export function calculatePortfolioRisk(
  assetReturns: number[][],
  weights: number[]
): number {
  const n = assetReturns.length;
  if (n === 0) return 0;

  // Build correlation/covariance matrix
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

// ─── Human-readable correlation insight ─────────────────────────────────────
export function getCorrelationInsight(
  symbolA: string,
  symbolB: string,
  r: number
): string {
  const abs = Math.abs(r);
  const direction = r > 0 ? 'tend to move in the same direction' : 'tend to move in opposite directions';

  if (abs > 0.9)
    return `${symbolA} and ${symbolB} are highly synchronised — they ${direction}. Holding both offers little diversification.`;
  if (abs > 0.7)
    return `${symbolA} and ${symbolB} are strongly correlated and ${direction} most of the time. Consider reducing overlap.`;
  if (abs > 0.4)
    return `${symbolA} and ${symbolB} share a moderate relationship and ${direction} more often than not.`;
  if (abs > 0.2)
    return `${symbolA} and ${symbolB} have a weak link — they ${direction} only occasionally.`;
  return `${symbolA} and ${symbolB} are largely independent. Holding both genuinely diversifies your portfolio.`;
}

// ─── High-level portfolio health insights ───────────────────────────────────
export function generatePortfolioInsights(assets: Asset[]): string[] {
  const insights: string[] = [];
  if (assets.length < 2) return ['Add more assets to unlock portfolio insights.'];

  const totalWeight = assets.reduce((s, a) => s + a.weight, 0) || 1;
  const normalizedWeights = assets.map(a => a.weight / totalWeight);

  // Concentration check
  const maxWeight = Math.max(...normalizedWeights);
  if (maxWeight > 0.5) {
    const heaviest = assets[normalizedWeights.indexOf(maxWeight)];
    insights.push(`⚠️ ${heaviest.symbol} makes up over 50 % of your portfolio — consider rebalancing.`);
  }

  // Average pairwise correlation
  let totalCorr = 0, pairs = 0;
  for (let i = 0; i < assets.length; i++) {
    for (let j = i + 1; j < assets.length; j++) {
      totalCorr += Math.abs(calculateCorrelation(assets[i].returns, assets[j].returns));
      pairs++;
    }
  }
  const avgCorr = pairs > 0 ? totalCorr / pairs : 0;

  if (avgCorr > 0.75)
    insights.push('🔴 Assets are highly correlated — your portfolio may not be well-diversified.');
  else if (avgCorr > 0.5)
    insights.push('🟡 Moderate correlation detected. Some diversification benefit exists.');
  else
    insights.push('🟢 Low average correlation — your portfolio benefits from strong diversification.');

  // Volatility spread
  const vols = assets.map(a => calculateStandardDeviation(a.returns));
  const maxVol = Math.max(...vols);
  const highVolAsset = assets[vols.indexOf(maxVol)];
  if (maxVol > 0.025)
    insights.push(`📊 ${highVolAsset.symbol} is the most volatile asset (daily σ ≈ ${(maxVol * 100).toFixed(1)} %).`);

  return insights;
}
