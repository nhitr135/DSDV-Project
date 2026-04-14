import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import Lucide from 'lucide-react';
import { Asset } from './constants.ts';
import { calculatePortfolioRisk, calculateCorrelation, cn } from './lib/utils';

const PRESET_PORTFOLIOS: { name: string; emoji: string; weights: Record<string, number> }[] = [
  {
    name: 'Tech Heavy',
    emoji: '💻',
    weights: { AAPL: 0.35, GOOGL: 0.30, TSLA: 0.25, BTC: 0.10 },
  },
  {
    name: 'Balanced',
    emoji: '⚖️',
    weights: { AAPL: 0.25, GOOGL: 0.25, TSLA: 0.25, BTC: 0.25 },
  },
  {
    name: 'Crypto-Heavy',
    emoji: '₿',
    weights: { AAPL: 0.10, GOOGL: 0.10, TSLA: 0.20, BTC: 0.60 },
  },
  {
    name: 'Conservative',
    emoji: '🛡️',
    weights: { AAPL: 0.50, GOOGL: 0.40, TSLA: 0.05, BTC: 0.05 },
  },
];

function computePortfolioStats(assets: Asset[], weights: Record<string, number>) {
  const validAssets = assets.filter(a => weights[a.symbol] !== undefined);
  if (validAssets.length === 0) return { risk: 0, avgReturn: 0, diversificationScore: 0, sharpe: 0 };

  const totalW = Object.values(weights).reduce((s, w) => s + w, 0) || 1;
  const normalizedWeights = validAssets.map(a => (weights[a.symbol] || 0) / totalW);
  const assetReturns = validAssets.map(a => a.returns);

  const risk = calculatePortfolioRisk(assetReturns, normalizedWeights);

  const avgReturn = validAssets.reduce((s, a, i) => {
      const mean = a.returns.reduce<number>((x, y) => x + y, 0) / a.returns.length;
      return s + mean * normalizedWeights[i];
  }, 0) * 252; // annualized

  // Diversification: 1 - avg pairwise correlation
  let totalCorr = 0, pairs = 0;
  for (let i = 0; i < validAssets.length; i++) {
    for (let j = i + 1; j < validAssets.length; j++) {
      totalCorr += Math.abs(calculateCorrelation(validAssets[i].returns, validAssets[j].returns));
      pairs++;
    }
  }
  const avgCorr = pairs > 0 ? totalCorr / pairs : 0;
  const diversificationScore = Math.round((1 - avgCorr) * 100);

  const annualRisk = risk * Math.sqrt(252);
  const sharpe = annualRisk > 0 ? ((avgReturn - 0.04) / annualRisk) : 0;

  return { risk: annualRisk * 100, avgReturn: avgReturn * 100, diversificationScore, sharpe };
}

interface Props {
  currentAssets: Asset[];
  currentWeights: Record<string, number>;
}

export default function PortfolioComparison({ currentAssets, currentWeights }: Props) {
  const [selectedPreset, setSelectedPreset] = useState<typeof PRESET_PORTFOLIOS[0]>(PRESET_PORTFOLIOS[1]);

  const statsA = useMemo(() => computePortfolioStats(currentAssets, currentWeights), [currentAssets, currentWeights]);
  const statsB = useMemo(() => computePortfolioStats(currentAssets, selectedPreset.weights), [currentAssets, selectedPreset]);

  const metrics = [
    {
      label: 'Annual Risk',
      a: statsA.risk.toFixed(1) + '%',
      b: statsB.risk.toFixed(1) + '%',
      better: statsA.risk < statsB.risk ? 'A' : statsB.risk < statsA.risk ? 'B' : null,
    },
    {
      label: 'Exp. Return',
      a: (statsA.avgReturn > 0 ? '+' : '') + statsA.avgReturn.toFixed(1) + '%',
      b: (statsB.avgReturn > 0 ? '+' : '') + statsB.avgReturn.toFixed(1) + '%',
      better: statsA.avgReturn > statsB.avgReturn ? 'A' : statsB.avgReturn > statsA.avgReturn ? 'B' : null,
    },
    {
      label: 'Diversification',
      a: statsA.diversificationScore + '/100',
      b: statsB.diversificationScore + '/100',
      better: statsA.diversificationScore > statsB.diversificationScore ? 'A' : statsB.diversificationScore > statsA.diversificationScore ? 'B' : null,
    },
    {
      label: 'Sharpe Ratio',
      a: statsA.sharpe.toFixed(2),
      b: statsB.sharpe.toFixed(2),
      better: statsA.sharpe > statsB.sharpe ? 'A' : statsB.sharpe > statsA.sharpe ? 'B' : null,
    },
  ];

  const aWins = metrics.filter(m => m.better === 'A').length;
  const bWins = metrics.filter(m => m.better === 'B').length;
  const overallWinner = aWins > bWins ? 'A' : bWins > aWins ? 'B' : null;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-2 mb-5">
        <div className="p-1.5 bg-indigo-50 rounded-lg">
          <Lucide.GitCompare className="text-indigo-500 w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-tight">Portfolio Comparison</h2>
          <p className="text-[10px] text-slate-400 font-medium">Your portfolio vs a preset strategy</p>
        </div>
      </div>

      {/* Preset selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {PRESET_PORTFOLIOS.map(p => (
          <button
            key={p.name}
            onClick={() => setSelectedPreset(p)}
            className={cn(
              "p-2.5 rounded-xl border text-center transition-all",
              selectedPreset.name === p.name
                ? "bg-indigo-50 border-indigo-200 shadow-sm"
                : "bg-slate-50 border-slate-200 hover:bg-slate-100"
            )}
          >
            <div className="text-base mb-0.5">{p.emoji}</div>
            <div className={cn("text-[9px] font-black uppercase tracking-tight", selectedPreset.name === p.name ? "text-indigo-600" : "text-slate-500")}>
              {p.name}
            </div>
          </button>
        ))}
      </div>

      {/* Headers */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className={cn(
          "rounded-xl p-3 text-center border",
          overallWinner === 'A' ? "bg-blue-600 border-blue-600" : "bg-slate-50 border-slate-200"
        )}>
          <div className={cn("text-[10px] font-black uppercase tracking-widest", overallWinner === 'A' ? "text-white/70" : "text-slate-400")}>Portfolio A</div>
          <div className={cn("text-xs font-bold", overallWinner === 'A' ? "text-white" : "text-slate-600")}>Your Mix</div>
          {overallWinner === 'A' && <div className="text-[8px] text-white/80 font-bold mt-0.5">🏆 WINNER</div>}
        </div>
        <div className="flex items-center justify-center">
          <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">vs</div>
        </div>
        <div className={cn(
          "rounded-xl p-3 text-center border",
          overallWinner === 'B' ? "bg-indigo-600 border-indigo-600" : "bg-slate-50 border-slate-200"
        )}>
          <div className={cn("text-[10px] font-black uppercase tracking-widest", overallWinner === 'B' ? "text-white/70" : "text-slate-400")}>Portfolio B</div>
          <div className={cn("text-xs font-bold", overallWinner === 'B' ? "text-white" : "text-slate-600")}>{selectedPreset.emoji} {selectedPreset.name}</div>
          {overallWinner === 'B' && <div className="text-[8px] text-white/80 font-bold mt-0.5">🏆 WINNER</div>}
        </div>
      </div>

      {/* Metrics comparison */}
      <div className="space-y-2">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className="grid grid-cols-3 gap-2 items-center"
          >
            <div className={cn(
              "p-2.5 rounded-xl text-center border transition-all",
              m.better === 'A' ? "bg-blue-50 border-blue-200" : "bg-slate-50 border-slate-200"
            )}>
              <div className={cn("text-sm font-black", m.better === 'A' ? "text-blue-700" : "text-slate-600")}>{m.a}</div>
              {m.better === 'A' && <div className="text-[8px] text-blue-500 font-bold">✓ better</div>}
            </div>

            <div className="text-center">
              <div className="text-[9px] font-bold text-slate-400 uppercase leading-tight">{m.label}</div>
            </div>

            <div className={cn(
              "p-2.5 rounded-xl text-center border transition-all",
              m.better === 'B' ? "bg-indigo-50 border-indigo-200" : "bg-slate-50 border-slate-200"
            )}>
              <div className={cn("text-sm font-black", m.better === 'B' ? "text-indigo-700" : "text-slate-600")}>{m.b}</div>
              {m.better === 'B' && <div className="text-[8px] text-indigo-500 font-bold">✓ better</div>}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Score summary */}
      <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
        <div className="text-center">
          <div className="text-2xl font-black text-blue-600">{aWins}</div>
          <div className="text-[9px] text-slate-400 font-bold uppercase">Your wins</div>
        </div>
        <div className="text-[10px] text-slate-400 font-medium text-center px-2">out of {metrics.length} metrics</div>
        <div className="text-center">
          <div className="text-2xl font-black text-indigo-600">{bWins}</div>
          <div className="text-[9px] text-slate-400 font-bold uppercase">Preset wins</div>
        </div>
      </div>
    </div>
  );
}