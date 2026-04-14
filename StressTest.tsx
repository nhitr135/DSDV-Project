import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import Lucide from 'lucide-react';
import { Asset } from './constants.ts';
import { cn } from './lib/utils';

interface Scenario {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
  bgColor: string;
  shocks: Record<string, number>; // symbol -> % change (e.g. -0.30 = -30%)
  globalShock: number; // fallback for unknown assets
}

const SCENARIOS: Scenario[] = [
  {
    id: 'covid',
    name: 'COVID Crash',
    emoji: '🦠',
    description: 'March 2020 market collapse. Tech fell hard, Bitcoin crashed 50%.',
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
    shocks: { AAPL: -0.32, GOOGL: -0.31, TSLA: -0.61, BTC: -0.50, ETH: -0.55, MSFT: -0.28, AMZN: -0.19, NVDA: -0.35, META: -0.29, GOLD: -0.12 },
    globalShock: -0.30,
  },
  {
    id: 'rate_hike',
    name: '2022 Rate Hike',
    emoji: '📈',
    description: 'Fed aggressively raised rates. Growth stocks & crypto crashed.',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 border-orange-200',
    shocks: { AAPL: -0.27, GOOGL: -0.39, TSLA: -0.65, BTC: -0.64, ETH: -0.68, MSFT: -0.28, AMZN: -0.50, NVDA: -0.50, META: -0.64, GOLD: -0.02 },
    globalShock: -0.35,
  },
  {
    id: 'bull_run',
    name: 'Bull Market Run',
    emoji: '🚀',
    description: '2023 AI-driven rally. Tech soared, crypto recovered strongly.',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 border-emerald-200',
    shocks: { AAPL: 0.48, GOOGL: 0.52, TSLA: 0.66, BTC: 1.55, ETH: 0.85, MSFT: 0.56, AMZN: 0.81, NVDA: 2.40, META: 1.94, GOLD: 0.13 },
    globalShock: 0.40,
  },
  {
    id: 'stagflation',
    name: 'Stagflation Shock',
    emoji: '⚡',
    description: 'High inflation + slow growth. Bad for equities, mixed for crypto.',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 border-yellow-200',
    shocks: { AAPL: -0.18, GOOGL: -0.22, TSLA: -0.30, BTC: -0.20, ETH: -0.25, MSFT: -0.15, AMZN: -0.25, NVDA: -0.20, META: -0.28, GOLD: 0.15 },
    globalShock: -0.20,
  },
  {
    id: 'crypto_winter',
    name: 'Crypto Winter',
    emoji: '❄️',
    description: '2018-style crypto collapse. BTC -80%, stocks hold relatively steady.',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
    shocks: { AAPL: -0.05, GOOGL: -0.07, TSLA: -0.10, BTC: -0.83, ETH: -0.94, MSFT: -0.04, AMZN: -0.08, NVDA: -0.56, META: -0.12, GOLD: 0.05 },
    globalShock: -0.10,
  },
];

interface Props {
  assets: Asset[];
}

export default function StressTest({ assets }: Props) {
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);

  const results = useMemo(() => {
    if (!selectedScenario) return null;
    const totalWeight = assets.reduce((s, a) => s + a.weight, 0) || 1;

    return assets.map(asset => {
      const shock = selectedScenario.shocks[asset.symbol] ?? selectedScenario.globalShock;
      const weightedImpact = (asset.weight / totalWeight) * shock;
      return { asset, shock, weightedImpact };
    });
  }, [selectedScenario, assets]);

  const totalImpact = results?.reduce((s, r) => s + r.weightedImpact, 0) ?? 0;
  const isPositive = totalImpact > 0;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-2 mb-5">
        <div className="p-1.5 bg-red-50 rounded-lg">
          <Lucide.Zap className="text-red-500 w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-tight">Stress Test</h2>
          <p className="text-[10px] text-slate-400 font-medium">Simulate historical market crises on your portfolio</p>
        </div>
      </div>

      {/* Scenario Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
        {SCENARIOS.map(scenario => (
          <button
            key={scenario.id}
            onClick={() => setSelectedScenario(prev => prev?.id === scenario.id ? null : scenario)}
            className={cn(
              "p-3 rounded-xl border text-left transition-all",
              selectedScenario?.id === scenario.id
                ? scenario.bgColor + " shadow-sm"
                : "bg-slate-50 border-slate-200 hover:bg-slate-100"
            )}
          >
            <div className="text-lg mb-1">{scenario.emoji}</div>
            <div className={cn("text-[10px] font-black uppercase tracking-tight", selectedScenario?.id === scenario.id ? scenario.color : "text-slate-600")}>
              {scenario.name}
            </div>
          </button>
        ))}
      </div>

      <> 
        {selectedScenario && results ? (
          <motion.div
            key={selectedScenario.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* Scenario description */}
            <div className={cn("p-3 rounded-xl border mb-4 flex items-start gap-2", selectedScenario.bgColor)}>
              <Lucide.AlertTriangle className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", selectedScenario.color)} />
              <p className={cn("text-[10px] font-medium leading-relaxed", selectedScenario.color)}>
                {selectedScenario.description}
              </p>
            </div>

            {/* Total impact banner */}
            <div className={cn(
              "rounded-2xl p-4 mb-4 text-center",
              isPositive ? "bg-emerald-600" : "bg-red-600"
            )}>
              <div className="text-white/70 text-[10px] font-bold uppercase tracking-widest mb-1">
                Estimated Portfolio Impact
              </div>
              <div className="text-white text-4xl font-black">
                {isPositive ? '+' : ''}{(totalImpact * 100).toFixed(1)}%
              </div>
              <div className="text-white/60 text-[10px] mt-1">
                {isPositive ? 'Estimated gain' : 'Estimated loss'} across your weighted portfolio
              </div>
            </div>

            {/* Per-asset breakdown */}
            <div className="space-y-2">
              {[...results].sort((a, b) => a.shock - b.shock).map((r, i) => (
                <motion.div
                  key={r.asset.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl"
                >
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                    style={{ backgroundColor: r.asset.color }}
                  >
                    {r.asset.symbol[0]}
                  </div>
                  <span className="text-xs font-bold text-slate-700 w-12 shrink-0">{r.asset.symbol}</span>
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", r.shock >= 0 ? "bg-emerald-500" : "bg-red-500")}
                      style={{ width: `${Math.min(100, Math.abs(r.shock) * 100)}%` }}
                    />
                  </div>
                  <span className={cn("text-xs font-black w-14 text-right shrink-0", r.shock >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {r.shock >= 0 ? '+' : ''}{(r.shock * 100).toFixed(0)}%
                  </span>
                </motion.div>
              ))}
            </div>

            <p className="text-[9px] text-slate-400 mt-3 text-center">
              Based on historical market data. Actual results may vary.
            </p>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
            <Lucide.TrendingDown className="text-slate-300 w-8 h-8 mb-2" />
            <p className="text-xs text-slate-400 text-center">Select a scenario above to see<br />how your portfolio would perform</p>
          </div>
        )}
      </>
    </div>
  );
}