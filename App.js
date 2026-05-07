// App.js — 6-Act narrative layout (PortfolioPulse)
// Story arc from the docx plan:
//   Act 1: Hook         (curious)
//   Act 2: Wake-up      (fear)
//   Act 3: Bridge       (relief)
//   Act 4: Plot twist   (mind-blown)
//   Act 5: Solution     (trust)    ← all interactive tools live here
//   Act 6: Conclusion   (action)

import { html, useState, useMemo } from './lib.js';
import {
  cn,
  calculatePortfolioRisk,
  generateMockReturns,
  getCorrelationInsight,
} from './utils.js';
import {
  REAL_RETURNS,
  INITIAL_ASSETS,
  buildPresetAssets,
} from './constants.js';

// ————— Narrative components (Acts 2, 3, 4, 6) —————
import { BTCDrawdownChart }       from './components/BTCDrawdownChart.js';
import { AllInHallOfPain }        from './components/AllInHallOfPain.js';
import { HumanizeLossCard }       from './components/HumanizeLossCard.js';
import { InvestorPsychology }     from './components/InvestorPsychology.js';
import { AllInVsDiversifiedChart } from './components/AllInVsDiversifiedChart.js';
import { TakeawayCards }          from './components/TakeawayCards.js';

// ————— Interactive tool components (Act 5) —————
import { RiskMeter }           from './components/RiskMeter.js';
import { PortfolioWeights }    from './components/PortfolioWeights.js';
import { AllocationPieChart }  from './components/AllocationPieChart.js';
import { AssetPickerModal }    from './components/AssetPickerModal.js';
import { CorrelationMatrix }   from './components/CorrelationMatrix.js';
import { PairScatterPlot }     from './components/PairScatterPlot.js';
import { DiversificationScore } from './components/DiversificationScore.js';
import { RiskRadar }           from './components/RiskRadar.js';
// Removed in Act 5 streamline: CorrelationBarChart (overlapped with Heatmap),
// WhatIfSimulator (replaced by sliders + future Swap button on weights),
// StressTestCompare (historical crises don't repeat — false sense of preparedness),
// PortfolioComparison (CSS-bar implementation, not real visualization;
//                      content overlapped with the Frontier markers),
// PortfolioHealth + PortfolioAdvisor (text-only insight cards — not viz).
import { AssetContribution }   from './components/AssetContribution.js';
import { EfficientFrontier }   from './components/EfficientFrontier.js';

import {
  TrendingUpIcon,
  ArrowRightIcon,
  LightbulbIcon,
  ShieldAlertIcon,
} from './components/icons.js';

// Navigation config for side-dots
const ACTS = [
  { id: 'act-1', label: 'Hook',         color: '#94a3b8' },
  { id: 'act-2', label: 'Wake-up',      color: '#ef4444' },
  { id: 'act-3', label: 'Bridge',       color: '#10b981' },
  { id: 'act-4', label: 'Plot Twist',   color: '#dc2626' },
  { id: 'act-5', label: 'Try It',       color: '#3b82f6' },
  { id: 'act-6', label: 'Takeaway',     color: '#0f172a' },
];

export function App() {
  // User-editable portfolio (used in Act 5 — the interactive section)
  const [assets,     setAssets]     = useState(INITIAL_ASSETS);
  const [hovered,    setHovered]    = useState({ a1: null, a2: null, r: null });
  const [showPicker, setShowPicker] = useState(false);

  // Pre-built FAANG "trap" portfolio for Act 4 (mind-blown moment)
  // Own hover state so Act 4 interaction doesn't collide with Act 5
  const [faangHover, setFaangHover] = useState({ a1: null, a2: null, r: null });
  const faangAssets = useMemo(() => {
    const faangWeights = { AAPL: 0.2, MSFT: 0.2, GOOGL: 0.2, NVDA: 0.2, META: 0.2 };
    return buildPresetAssets(faangWeights).map((a, i) => ({
      ...a,
      id: `faang-${i}`,
      weight: faangWeights[a.symbol],
      amount: 2000,
    }));
  }, []);

  // Derived state for user portfolio
  const totalAmount = useMemo(() =>
    assets.reduce((s, a) => s + (a.amount || 0), 0), [assets]);

  const assetsWithWeight = useMemo(() =>
    assets.map(a => ({
      ...a,
      weight: totalAmount === 0 ? 1 / assets.length : (a.amount || 0) / totalAmount,
    })), [assets, totalAmount]);

  const portfolioRisk = useMemo(() =>
    calculatePortfolioRisk(assetsWithWeight.map(a => a.returns), assetsWithWeight.map(a => a.weight)),
    [assetsWithWeight]);

  // (Removed `insights` memo: was only used by PortfolioHealth, which we
  // dropped along with PortfolioAdvisor and PortfolioComparison in the
  // Act 5 streamline.)

  const currentWeightsMap = useMemo(() =>
    Object.fromEntries(assetsWithWeight.map(a => [a.symbol, a.weight])),
    [assetsWithWeight]);

  // Handlers
  const handleAmount = (id, val) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setAssets(prev => prev.map(a => a.id === id ? { ...a, amount: num } : a));
  };

  const removeAsset = id => {
    if (assets.length > 2) setAssets(prev => prev.filter(a => a.id !== id));
  };

  // Bulk-update amounts (used by EfficientFrontier's Auto-Optimize / marker
  // clicks — applies a whole {id: dollars} map at once instead of N sequential
  // handleAmount calls).
  const handleSetAllAmounts = (amountsById) => {
    setAssets(prev => prev.map(a => ({
      ...a,
      amount: amountsById[a.id] != null ? Math.max(0, amountsById[a.id]) : a.amount,
    })));
  };

  const handlePickAsset = catalogItem => {
    setAssets(prev => [...prev, {
      id:      Math.random().toString(36).slice(2, 9),
      symbol:  catalogItem.symbol,
      name:    catalogItem.name,
      color:   catalogItem.color,
      sector:  catalogItem.sector,
      amount:  0,
      returns: REAL_RETURNS[catalogItem.symbol]
               ?? generateMockReturns(catalogItem.drift, catalogItem.vol, 60, catalogItem.symbol),
    }]);
    setShowPicker(false);
  };

  // Shared correlation-insight panel (used in both Act 4 & Act 5)
  const InsightPanel = ({ state }) => {
    if (!(state.a1 && state.a2 && state.r !== null)) {
      return html`
        <div class="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 min-h-[280px]">
          <div class="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
            <${ArrowRightIcon} className="text-slate-300 w-6 h-6" />
          </div>
          <h3 class="text-sm font-bold text-slate-400 uppercase mb-1">Hover any cell</h3>
          <p class="text-xs text-slate-400 max-w-[200px]">See how two assets relate — with a scatter plot and a plain-English explanation</p>
        </div>`;
    }
    return html`
      <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 animate-enter">
        <div class="flex items-center gap-3 mb-3">
          <div class="flex -space-x-2">
            <div class="w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-[10px] font-bold text-white"
              style=${{ backgroundColor: state.a1.color }}>${state.a1.symbol[0]}</div>
            <div class="w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-[10px] font-bold text-white"
              style=${{ backgroundColor: state.a2.color }}>${state.a2.symbol[0]}</div>
          </div>
          <div>
            <div class="text-xs font-bold text-slate-700">${state.a1.symbol} vs ${state.a2.symbol}</div>
            <div class="text-[9px] text-slate-400">Each dot = one trading day</div>
          </div>
          <div class="ml-auto text-right">
            <div class="text-2xl font-black text-slate-900">${Math.round(state.r * 100)}%</div>
            <div class="text-[9px] font-bold uppercase tracking-wide"
              style=${{ color: state.r > 0.5 ? '#ef4444' : state.r < -0.3 ? '#10b981' : '#94a3b8' }}>
              ${state.r > 0.7 ? 'High risk' : state.r > 0.4 ? 'Moderate' : state.r < -0.3 ? 'Good hedge' : 'Independent'}
            </div>
          </div>
        </div>
        ${state.a1.symbol !== state.a2.symbol && html`
          <div class="bg-white rounded-xl border border-slate-100 p-2 mb-3">
            <${PairScatterPlot} a1=${state.a1} a2=${state.a2} r=${state.r} />
          </div>`}
        <div class="p-3 bg-blue-600 rounded-xl">
          <div class="flex items-center gap-1.5 text-white/70 mb-1">
            <${LightbulbIcon} className="w-3 h-3" />
            <span class="text-[9px] font-bold uppercase tracking-wide">What this means for you</span>
          </div>
          <p class="text-[11px] text-white font-medium leading-relaxed">
            ${getCorrelationInsight(state.a1.symbol, state.a2.symbol, state.r)}
          </p>
        </div>
      </div>`;
  };

  return html`
    <div class="min-h-screen text-slate-900 overflow-x-hidden">

      <!-- Minimal sticky header -->
      <header class="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 sticky top-0 z-40">
        <div class="max-w-7xl mx-auto flex justify-between items-center">
          <div class="flex items-center gap-2">
            <div class="bg-blue-600 p-1.5 rounded-lg">
              <${TrendingUpIcon} className="text-white w-5 h-5" />
            </div>
            <h1 class="text-lg font-bold tracking-tight text-slate-800">
              Portfolio<span class="text-blue-600">Pulse</span>
            </h1>
          </div>
          <a href="#act-5"
            class="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm">
            Skip to tool →
          </a>
        </div>
      </header>

      <!-- Side-navigation dots -->
      <nav class="hidden lg:flex flex-col gap-3 fixed right-6 top-1/2 -translate-y-1/2 z-30">
        ${ACTS.map((act, i) => html`
          <a key=${act.id} href=${'#' + act.id}
            class="group flex items-center gap-2 justify-end"
            title=${act.label}>
            <span class="text-[10px] font-black text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">
              ${i + 1}. ${act.label}
            </span>
            <div class="w-3 h-3 rounded-full border-2 border-white shadow transition-all group-hover:scale-125"
              style=${{ backgroundColor: act.color }}></div>
          </a>`)}
      </nav>

      <!-- ════════════════════════════════════════════════════════════ -->
      <!-- ACT 1 — THE HOOK (light minimalist redesign)                 -->
      <!-- ════════════════════════════════════════════════════════════ -->
      <!-- Switched from dark gradient (.hero-dark) to explicit bg-white
           Tailwind class. The previous design relied on styles.css's
           radial gradients which weren't rendering reliably, leaving white
           text on a near-white background. This minimalist version is
           safer, easier to read, and matches the "data viz academic" feel. -->
      <section id="act-1" class="bg-white min-h-screen flex items-center py-20 px-6 border-b border-slate-200">
        <div class="max-w-5xl mx-auto w-full">
          <!-- Opening title -->
          <div class="text-center mb-14 animate-act-in">
            <span class="inline-block text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 border-b-2 border-red-500 pb-1 mb-10">
              A Data-Viz Story
            </span>
            <h1 class="text-6xl md:text-8xl font-black tracking-tight text-slate-900 mb-6 leading-none">
              Portfolio<span class="text-red-600">Pulse</span>
            </h1>
            <p class="text-xl md:text-3xl text-slate-700 font-bold max-w-3xl mx-auto leading-tight">
              Why investing <em class="not-italic underline decoration-slate-300 decoration-2 underline-offset-4">"right"</em> can still <span class="text-red-600">wipe you out</span>.
            </p>
            <p class="text-slate-500 text-base mt-5 max-w-xl mx-auto">
              A 4-minute journey through the mistake every new investor makes — and the one tool that reveals it.
            </p>
          </div>

          <!-- The provocative question -->
          <div class="max-w-4xl mx-auto">
            <p class="text-center text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-5">
              You have $100,000. Which would you pick?
            </p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              ${[
                { emoji: '🚀', title: 'ALL-IN BTC',      sub: '100% Bitcoin',                       accent: 'text-orange-600' },
                { emoji: '📊', title: '5 FAANG Stocks',  sub: 'AAPL + MSFT + GOOGL + NVDA + META',  accent: 'text-blue-600'   },
                { emoji: '🛡️', title: 'Diversified',    sub: 'Stocks + ETFs + Gold + Bonds',        accent: 'text-emerald-600' },
              ].map(choice => html`
                <div key=${choice.title}
                  class="rounded-xl p-6 border border-slate-200 bg-white hover:border-slate-400 transition-colors text-center">
                  <div class="text-3xl mb-3">${choice.emoji}</div>
                  <h3 class=${`text-base font-black mb-1 ${choice.accent}`}>${choice.title}</h3>
                  <p class="text-slate-500 text-xs">${choice.sub}</p>
                </div>`)}
            </div>
            <p class="text-center text-slate-400 text-xs italic mt-6">
              Hold your answer in your head. We'll come back to it at the end.
            </p>
          </div>

          <!-- Scroll cue -->
          <div class="mt-14 text-center">
            <a href="#act-2" class="inline-flex flex-col items-center text-slate-400 hover:text-slate-700 transition-colors">
              <span class="text-[11px] font-bold uppercase tracking-widest mb-2">Scroll to start</span>
              <div class="w-6 h-10 rounded-full border-2 border-slate-300 flex items-start justify-center p-1.5">
                <div class="w-1 h-2 rounded-full bg-slate-400 animate-bounce"></div>
              </div>
            </a>
          </div>
        </div>
      </section>

      <!-- ════════════════════════════════════════════════════════════ -->
      <!-- ACT 2 — THE WAKE-UP CALL                                     -->
      <!-- ════════════════════════════════════════════════════════════ -->
      <!-- Added explicit bg-slate-950 (not relying on .act-wake-up CSS).
           This guarantees the dark backdrop renders even if styles.css
           fails to load — the closer "ALL-IN = ALL-OR-NOTHING" text uses
           text-white and was invisible on a light fallback background. -->
      <section id="act-2" class="act-wake-up bg-slate-950 py-20 px-6">
        <div class="max-w-6xl mx-auto space-y-12">

          <!-- Act header.
               Note: the "Act II/III/..." labels were intentional scaffolding
               for the writer; we removed them from the UI but kept them in
               the report. The id="act-2" on the section is what powers the
               navigation dots, not a visible label. -->
          <div class="text-center max-w-3xl mx-auto animate-act-in">
            <div class="text-red-400 text-xs font-black uppercase tracking-[0.3em] mb-4">
              The Wake-up Call
            </div>
            <h2 class="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
              In 2021, everyone thought they were a genius.
            </h2>
            <p class="text-slate-400 text-lg leading-relaxed">
              Bitcoin at $69,000. Tesla up 10x in two years. Every tweet said: <span class="italic">"just put all your money in."</span>
            </p>
            <p class="text-red-300 text-lg font-bold mt-2">Then reality arrived.</p>
          </div>

          <!-- Slide 4: BTC Drawdown -->
          <${BTCDrawdownChart} />

          <!-- Slide 4.5: Hall of Pain — proof that ALL-IN crash isn't BTC-only -->
          <${AllInHallOfPain} />

          <!-- Slide 5: Humanize the loss -->
          <${HumanizeLossCard} />

          <!-- Slide 6: Investor psychology -->
          <${InvestorPsychology} />

          <!-- Slide 7: Act closer -->
          <div class="text-center py-12">
            <h2 class="text-5xl md:text-7xl font-black text-white mb-4 leading-none">
              ALL-IN =
              <br />
              <span class="text-red-500">ALL-OR-NOTHING</span>
            </h2>
            <p class="text-slate-400 text-lg mt-6">So is there another way?</p>
          </div>
        </div>
      </section>

      <!-- ════════════════════════════════════════════════════════════ -->
      <!-- ACT 3 — THE BRIDGE                                           -->
      <!-- ════════════════════════════════════════════════════════════ -->
      <section id="act-3" class="act-bridge bg-emerald-50/40 py-20 px-6">
        <div class="max-w-6xl mx-auto space-y-10">

          <div class="text-center max-w-3xl mx-auto animate-act-in">
            <div class="text-emerald-700 text-xs font-black uppercase tracking-[0.3em] mb-4">
              The Bridge
            </div>
            <h2 class="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-4">
              What if you didn't go all-in?
            </h2>
            <p class="text-slate-600 text-lg leading-relaxed">
              Split the money. Some into growth stocks. Some into ETFs. Some into bonds. Some into gold.
            </p>
            <p class="text-emerald-700 text-lg font-bold mt-2">What actually happens?</p>
          </div>

          <!-- THE key chart -->
          <${AllInVsDiversifiedChart} />

          <!-- Slide 10: The lesson -->
          <div class="text-center py-12 max-w-3xl mx-auto">
            <p class="text-3xl md:text-4xl font-black text-slate-900 italic leading-tight">
              "Diversification is not about ${' '}
              <span class="text-emerald-600">maximizing returns</span> ${' '}—${' '}
              it's about ${' '}<span class="text-red-600">minimizing regret</span>."
            </p>
            <p class="text-slate-500 text-sm mt-6 leading-relaxed">
              In 2019, nobody predicted COVID. In 2021, nobody predicted Crypto Winter.
              <br />
              You can't predict the future — but you can prepare for it.
            </p>
          </div>
        </div>
      </section>

      <!-- ════════════════════════════════════════════════════════════ -->
      <!-- ACT 4 — THE PLOT TWIST                                       -->
      <!-- ════════════════════════════════════════════════════════════ -->
      <section id="act-4" class="act-twist bg-rose-50/40 py-20 px-6">
        <div class="max-w-6xl mx-auto space-y-10">

          <!-- The setup question -->
          <div class="text-center max-w-3xl mx-auto animate-act-in">
            <div class="text-red-700 text-xs font-black uppercase tracking-[0.3em] mb-4">
              The Plot Twist
            </div>
            <h2 class="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-4">
              "So I just buy 5 big-tech stocks, right?"
            </h2>
            <div class="flex items-center justify-center gap-2 my-6 flex-wrap">
              ${['🍎 AAPL', '🪟 MSFT', '🔍 GOOGL', '🎮 NVDA', '📘 META'].map(s => html`
                <div key=${s} class="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-bold shadow-sm">
                  ${s}
                </div>`)}
            </div>
            <p class="text-slate-600 text-lg leading-relaxed">
              Five different companies. Five different stocks. Sounds diversified, right?
            </p>
            <p class="text-3xl font-black text-red-600 mt-4">No.</p>
          </div>

          <!-- The Mind-Blow Heatmap -->
          <div class="bg-white p-6 rounded-3xl shadow-xl border border-red-200">
            <div class="text-center mb-5">
              <h3 class="text-2xl font-black text-slate-900">Here's the correlation between those 5 stocks.</h3>
              <p class="text-slate-500 text-sm mt-1">Red = they rise and fall together. Green = they hedge each other.</p>
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
              <div class="xl:col-span-3">
                <${CorrelationMatrix}
                  assets=${faangAssets}
                  onCellHover=${(a1, a2, r) => setFaangHover({ a1, a2, r })}
                />
              </div>
              <div class="xl:col-span-2">
                <${InsightPanel} state=${faangHover} />
              </div>
            </div>

            <!-- Verdict banner -->
            <div class="mt-6 p-5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 text-center">
              <p class="text-white text-xl md:text-2xl font-black leading-tight">
                You don't have 5 investments.
                <br />
                You have <span class="underline decoration-white/50">one investment — bought 5 times</span>.
              </p>
            </div>
          </div>

          <!-- Slide 13: The realization -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div class="p-6 rounded-2xl bg-red-50 border-2 border-red-200">
              <div class="text-[10px] font-black text-red-700 uppercase tracking-widest mb-3">❌ Fake diversification</div>
              <div class="text-lg font-black text-slate-900 mb-2">5 FAANG stocks</div>
              <div class="text-4xl font-black text-red-600 mb-2">~85%</div>
              <div class="text-xs text-slate-600">Average correlation</div>
              <div class="text-sm text-red-700 mt-3 italic">When one falls, they all fall.</div>
            </div>
            <div class="p-6 rounded-2xl bg-emerald-50 border-2 border-emerald-200">
              <div class="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-3">✅ Real diversification</div>
              <div class="text-lg font-black text-slate-900 mb-2">AAPL + GOLD + TLT + BTC</div>
              <div class="text-4xl font-black text-emerald-600 mb-2">~15%</div>
              <div class="text-xs text-slate-600">Average correlation</div>
              <div class="text-sm text-emerald-700 mt-3 italic">When one falls, the others hold steady.</div>
            </div>
          </div>

          <!-- Bridge to Act 5 -->
          <div class="text-center pt-8">
            <p class="text-slate-600 text-lg font-bold">
              So the real question isn't <span class="italic">"how many stocks do I own?"</span>
            </p>
            <p class="text-slate-900 text-2xl font-black mt-2">
              It's <span class="text-blue-600">"how do I measure real diversification?"</span>
            </p>
            <p class="text-slate-500 text-sm mt-4">That's what we built this tool for.</p>
          </div>
        </div>
      </section>

      <!-- ════════════════════════════════════════════════════════════ -->
      <!-- ACT 5 — THE SOLUTION (Interactive Demo)                      -->
      <!-- ════════════════════════════════════════════════════════════ -->
      <section id="act-5" class="bg-slate-50 py-16 px-6">
        <div class="max-w-7xl mx-auto">

          <!-- Act intro -->
          <div class="text-center max-w-3xl mx-auto mb-12 animate-act-in">
            <div class="text-blue-700 text-xs font-black uppercase tracking-[0.3em] mb-4">
              The Solution
            </div>
            <h2 class="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-4">
              Try it yourself.
            </h2>
            <p class="text-slate-600 text-lg leading-relaxed">
              Build a portfolio on the left. Watch five dimensions of risk update on the right.
            </p>
            <p class="text-slate-500 text-sm mt-3">
              15 real assets · 8 years of data · 5 historical crisis scenarios
            </p>
          </div>

          <!-- Two-column layout: sticky sidebar + scroll content -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">

            <!-- ─────────────────────────────────────────────────── -->
            <!-- LEFT SIDEBAR (sticky) — "WHAT" headline metrics    -->
            <!-- + portfolio controls. Stays in view while user      -->
            <!-- scrolls right column for "WHY" deep dives.          -->
            <!-- ─────────────────────────────────────────────────── -->
            <div class="lg:col-span-4 space-y-4 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-2">

              <!-- HEADLINE: Diversification Score — "verdict line" of Act 5.
                   Promoted from a full-width Step to a compact card so it's
                   always visible as user scrolls the analysis column. -->
              <div>
                <div class="flex items-baseline gap-2 mb-2">
                  <span class="text-blue-600 text-[10px] font-black uppercase tracking-widest">Headline</span>
                  <span class="text-slate-400 text-[10px]">how diversified am I?</span>
                </div>
                <${DiversificationScore} assets=${assetsWithWeight} compact=${true} />
              </div>

              <!-- Risk Meter — single-number portfolio volatility -->
              <section class="bg-slate-900 text-white p-5 rounded-2xl shadow-xl relative overflow-hidden">
                <div class="absolute top-0 right-0 p-4 opacity-5">
                  <${ShieldAlertIcon} className="w-32 h-32" />
                </div>
                <${RiskMeter} risk=${portfolioRisk} />
              </section>

              <!-- Risk Contribution — "which assets drive my risk".
                   Promoted from Step 8 in main column to sidebar so it
                   sits next to the Risk Meter (same conceptual cluster). -->
              <div>
                <div class="flex items-baseline gap-2 mb-2">
                  <span class="text-blue-600 text-[10px] font-black uppercase tracking-widest">Risk drivers</span>
                  <span class="text-slate-400 text-[10px]">which assets contribute most</span>
                </div>
                <${AssetContribution} assets=${assetsWithWeight} compact=${true} />
              </div>

              <!-- Portfolio Weights & allocation -->
              <${PortfolioWeights}
                assets=${assets}
                assetsWithWeight=${assetsWithWeight}
                totalAmount=${totalAmount}
                onAdd=${() => setShowPicker(true)}
                onRemove=${removeAsset}
                onAmountChange=${handleAmount}
              />

              <${AllocationPieChart} assets=${assetsWithWeight} />
            </div>

            <!-- ─────────────────────────────────────────────────── -->
            <!-- RIGHT MAIN COLUMN — "WHY" deep-dive visualizations  -->
            <!-- ─────────────────────────────────────────────────── -->
            <div class="lg:col-span-8 space-y-6">

              <!-- Section 1: Efficient Frontier — the centerpiece.
                   Markowitz MPT cloud + Pareto frontier + CML +
                   Auto-Optimize + click-to-pin + Frontier Explorer overlay.

                   No "Step N" prefix — after streamlining we have only 3
                   sections; numbering felt like over-scaffolding. Heading
                   is text-xl bold so it scans as a section break, not a
                   small caption. -->
              <div>
                <h3 class="text-xl md:text-2xl font-black text-slate-900 leading-tight mb-1">
                  Where do you sit on the risk-return frontier?
                </h3>
                <p class="text-slate-500 text-sm mb-4">
                  1,500 possible mixes. One curve of "best you can do." Find your sweet spot.
                </p>
                <${EfficientFrontier}
                  assets=${assetsWithWeight}
                  currentWeights=${currentWeightsMap}
                  onApplyWeights=${handleSetAllAmounts}
                />
              </div>

              <!-- Section 2: Risk Radar — 5 dimensions of risk.
                   Complementary to the single-number Risk Meter in sidebar:
                   shows WHERE the risk concentrates (sector, asset class, etc.) -->
              <div>
                <h3 class="text-xl md:text-2xl font-black text-slate-900 leading-tight mb-1">
                  Five dimensions of risk
                </h3>
                <p class="text-slate-500 text-sm mb-4">
                  A single risk number hides shape. The radar shows where the danger comes from.
                </p>
                <${RiskRadar} assets=${assetsWithWeight} />
              </div>

              <!-- Section 3: Correlation Matrix + scatter plot pair -->
              <div>
                <h3 class="text-xl md:text-2xl font-black text-slate-900 leading-tight mb-1">
                  Your own correlation map
                </h3>
                <p class="text-slate-500 text-sm mb-4">
                  Hover any cell — see the scatter plot and a plain-English explanation of how the pair moves together.
                </p>
                <section class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div class="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
                    <div class="xl:col-span-3">
                      <${CorrelationMatrix}
                        assets=${assetsWithWeight}
                        onCellHover=${(a1, a2, r) => setHovered({ a1, a2, r })}
                      />
                    </div>
                    <div class="xl:col-span-2">
                      <${InsightPanel} state=${hovered} />
                    </div>
                  </div>
                </section>
              </div>

              <!-- Removed in this streamline:
                   - Portfolio Comparison: bar chart comparing user vs Buffett,
                     60/40, etc. Implementation was CSS divs (not real D3
                     visualization); content overlapped with the Frontier
                     (which already shows where "you" sit vs optimum).
                   - PortfolioHealth + Advisor: text-only insight cards.
                     Not visualization — and a Data Visualization course
                     should not be padded with text generators. -->

            </div>
          </div>
        </div>
      </section>

      <!-- ════════════════════════════════════════════════════════════ -->
      <!-- ACT 6 — CONCLUSION                                           -->
      <!-- ════════════════════════════════════════════════════════════ -->
      <section id="act-6" class="bg-white py-20 px-6 border-t border-slate-200">
        <div class="max-w-6xl mx-auto">
          <${TakeawayCards} />

          <!-- Call to action -->
          <div class="mt-12 text-center">
            <a href="#act-5"
              class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg transition-all">
              <${TrendingUpIcon} className="w-5 h-5" />
              Build your own portfolio
            </a>
            <p class="text-slate-400 text-xs mt-4">
              Built with React · D3 · 8 years of real historical data
            </p>
          </div>
        </div>
      </section>

      <!-- Asset Picker Modal -->
      ${showPicker && html`
        <${AssetPickerModal}
          existingSymbols=${new Set(assets.map(a => a.symbol))}
          onAdd=${handlePickAsset}
          onClose=${() => setShowPicker(false)}
        />`}
    </div>`;
}
