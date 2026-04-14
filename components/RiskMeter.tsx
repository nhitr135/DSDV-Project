import React from 'react';

interface Props {
  risk: number;
}

export default function RiskMeter({ risk }: Props) {
  const pct = Math.min(Math.max((risk * 100) / 4, 0), 1) * 100;
  let label = 'Low Risk', bar = '#10b981', txt = '#6ee7b7';
  if (risk > 0.03)       { label = 'High Risk';   bar = '#ef4444'; txt = '#fca5a5'; }
  else if (risk > 0.015) { label = 'Medium Risk'; bar = '#f59e0b'; txt = '#fcd34d'; }

  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: txt }}>
          {label}
        </span>
        <span className="text-3xl font-black text-white">{(risk * 100).toFixed(2)}%</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: bar }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>0%</span><span>Daily Std Dev</span><span>4%+</span>
      </div>
    </div>
  );
}
