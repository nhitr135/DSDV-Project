import { useMemo } from 'react';
import { motion } from 'motion/react';
import Lucide from 'lucide-react';
import { Asset } from './constants';
import { calculatePortfolioRisk, calculateStandardDeviation } from './lib/utils';

interface Props {
  assets: Asset[];
}

export default function AssetContribution({ assets }: Props) {
  const contributions = useMemo(() => {
    const totalWeight = assets.reduce((s, a) => s + a.weight, 0);
    const normalizedWeights = totalWeight === 0
      ? assets.map(() => 1 / assets.length)
      : assets.map(a => a.weight / totalWeight);

    const baseRisk = calculatePortfolioRisk(
      assets.map(a => a.returns),
      normalizedWeights
    );

    // Marginal contribution: risk with asset at 0 vs current
    const marginals = assets.map((asset, i) => {
      const tweakedWeights = normalizedWeights.map((w, j) => {
        if (j === i) return 0;
        const remaining = normalizedWeights.reduce((s, ww, jj) => jj !== i ? s + ww : s, 0);
        return remaining === 0 ? 1 / (assets.length - 1) : w / remaining;
      });
      const riskWithout = calculatePortfolioRisk(
        assets.map(a => a.returns),
        tweakedWeights
      );
      const marginal = Math.max(0, baseRisk - riskWithout);
      return { asset, marginal };
    });

    const totalMarginal = marginals.reduce((s, c) => s + c.marginal, 0) || 1;

    return marginals.map(c => ({
      asset: c.asset,
      contribution: c.marginal / totalMarginal,
      pct: Math.round((c.marginal / totalMarginal) * 100),
      volatility: calculateStandardDeviation(c.asset.returns) * 100,
    })).sort((a, b) => b.contribution - a.contribution);
  }, [assets]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-2 mb-5">
        <div className="p-1.5 bg-orange-50 rounded-lg">
          <Lucide.PieChart className="text-orange-500 w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-tight">Risk Contribution</h2>
          <p className="text-[10px] text-slate-400 font-medium">How much each asset drives portfolio risk</p>
        </div>
      </div>

      <div className="space-y-3">
        {contributions.map((item, i) => (
          <motion.div
            key={item.asset.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: item.asset.color }}
                >
                  {item.asset.symbol[0]}
                </div>
                <span className="text-xs font-bold text-slate-700">{item.asset.symbol}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-400">vol {item.volatility.toFixed(1)}%</span>
                <span className="text-xs font-black text-slate-800 w-8 text-right">{item.pct}%</span>
              </div>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: item.asset.color }}
                initial={{ width: 0 }}
                animate={{ width: `${item.pct}%` }}
                transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-5 pt-4 border-t border-slate-100">
        {(() => {
          const topContributor = contributions[0];
          const top2 = contributions.slice(0, 2);
          const top2pct = top2.reduce((s, c) => s + c.pct, 0);
          return (
            <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-xl border border-orange-100">
              <Lucide.BarChart2 className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-orange-700 font-medium leading-relaxed">
                <span className="font-black">{topContributor?.asset.symbol}</span> is your biggest risk driver at{' '}
                <span className="font-black">{topContributor?.pct}%</span>.{' '}
                {top2pct > 70
                  ? `Top 2 assets (${top2.map(c => c.asset.symbol).join(' & ')}) account for ${top2pct}% of portfolio risk.`
                  : 'Risk is relatively distributed across your portfolio.'}
              </p>
            </div>
          );
        })()}
      </div>
    </div>
  );
}