import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function calculateCorrelation(x, y) {
  const n = x.length;
  if (n !== y.length || n === 0) return 0;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const sumY2 = y.reduce((a, b) => a + b * b, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  if (denominator === 0) return 0;
  return numerator / denominator;
}

export function calculateStandardDeviation(values) {
  const n = values.length;
  if (n === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  return Math.sqrt(variance);
}

export function calculatePortfolioRisk(assetReturns, weights) {
  if (!assetReturns.length) return 0;
  const numDays = assetReturns[0].length;
  const portfolioDailyReturns = [];

  for (let d = 0; d < numDays; d++) {
    let dayReturn = 0;
    for (let a = 0; a < assetReturns.length; a++) {
      dayReturn += assetReturns[a][d] * weights[a];
    }
    portfolioDailyReturns.push(dayReturn);
  }

  return calculateStandardDeviation(portfolioDailyReturns);
}

export function getCorrelationInsight(a1, a2, r) {
  const absR = Math.abs(r);
  if (a1 === a2) return "This is the same asset (perfect correlation).";
  if (r > 0.8) return `${a1} and ${a2} move almost perfectly together → You might be facing "double risk" if both drop.`;
  if (r > 0.5) return `${a1} and ${a2} have a strong positive relationship → They tend to follow the same market trends.`;
  if (r < -0.5) return `${a1} and ${a2} move in opposite directions → This provides excellent hedging for your portfolio.`;
  if (absR < 0.2) return `${a1} and ${a2} have very little correlation → This is great for diversification.`;
  return `${a1} and ${a2} have a moderate relationship.`;
}

export function generatePortfolioInsights(assets) {
  const insights = [];
  let highCorrCount = 0;
  let totalPairs = 0;
  const highCorrPairs = [];

  for (let i = 0; i < assets.length; i++) {
    for (let j = i + 1; j < assets.length; j++) {
      totalPairs++;
      const r = calculateCorrelation(assets[i].returns, assets[j].returns);
      if (r > 0.6) {
        highCorrCount++;
        highCorrPairs.push(`${assets[i].symbol} & ${assets[j].symbol}`);
      }
    }
  }

  const highCorrRatio = totalPairs > 0 ? highCorrCount / totalPairs : 0;

  if (highCorrRatio > 0.6) {
    insights.push(`Warning: ${Math.round(highCorrRatio * 100)}% of your asset pairs have high correlation.`);
    insights.push("Your portfolio is not well diversified; many assets may drop at the same time.");
  } else if (highCorrRatio < 0.2) {
    insights.push("Great job! Your portfolio has low internal correlation, providing good diversification.");
  } else {
    insights.push("Your portfolio has a balanced mix of correlated and independent assets.");
  }

  if (highCorrPairs.length > 0) {
    insights.push(`Major risk overlap detected between: ${highCorrPairs.slice(0, 2).join(", ")}.`);
  }

  return insights;
}
