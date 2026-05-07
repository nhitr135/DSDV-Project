import { REAL_RETURNS, REAL_SHOCKS } from './returns_data.js';
import { generateMockReturns } from './utils.js';
export { REAL_RETURNS, REAL_SHOCKS };

// Fallback nếu một mã nào đó bị thiếu trong returns_data.js
function getReturns(symbol, drift, vol) {
  return REAL_RETURNS[symbol] ?? generateMockReturns(drift, vol, 60, symbol);
}

export const ASSET_CATALOG = [
  { symbol: 'AAPL',  name: 'Apple Inc.',        color: '#60a5fa', sector: 'Tech',      drift: 0.0005, vol: 0.015 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.',     color: '#f87171', sector: 'Tech',      drift: 0.0004, vol: 0.014 },
  { symbol: 'TSLA',  name: 'Tesla, Inc.',       color: '#fbbf24', sector: 'EV/Tech',   drift: 0.0008, vol: 0.030 },
  { symbol: 'BTC',   name: 'Bitcoin',           color: '#f59e0b', sector: 'Crypto',    drift: 0.0010, vol: 0.040 },
  { symbol: 'MSFT',  name: 'Microsoft Corp.',   color: '#34d399', sector: 'Tech',      drift: 0.0006, vol: 0.013 },
  { symbol: 'AMZN',  name: 'Amazon.com Inc.',   color: '#818cf8', sector: 'Tech',      drift: 0.0005, vol: 0.018 },
  { symbol: 'NVDA',  name: 'NVIDIA Corp.',      color: '#fb923c', sector: 'Tech',      drift: 0.0012, vol: 0.035 },
  { symbol: 'META',  name: 'Meta Platforms',    color: '#e879f9', sector: 'Tech',      drift: 0.0007, vol: 0.022 },
  { symbol: 'ETH',   name: 'Ethereum',          color: '#6366f1', sector: 'Crypto',    drift: 0.0009, vol: 0.038 },
  { symbol: 'GOLD',  name: 'Gold (ETF)',        color: '#eab308', sector: 'Commodity', drift: 0.0002, vol: 0.008 },
  { symbol: 'SPY',   name: 'S&P 500 ETF',      color: '#14b8a6', sector: 'Index',     drift: 0.0004, vol: 0.010 },
  { symbol: 'QQQ',   name: 'Nasdaq 100 ETF',   color: '#0ea5e9', sector: 'Index',     drift: 0.0005, vol: 0.013 },
  { symbol: 'TLT',   name: 'Treasury Bond ETF', color: '#94a3b8', sector: 'Bond',      drift: 0.0001, vol: 0.007 },
  { symbol: 'VNQ',   name: 'Real Estate ETF',  color: '#84cc16', sector: 'REIT',      drift: 0.0003, vol: 0.012 },
  { symbol: 'XOM',   name: 'ExxonMobil Corp.', color: '#f97316', sector: 'Energy',    drift: 0.0003, vol: 0.016 },
];

// Quick-lookup map for catalog entries (symbol → full meta)
export const CATALOG_MAP = Object.fromEntries(ASSET_CATALOG.map(a => [a.symbol, a]));

export const SECTOR_COLORS = {
  'Tech':      '#60a5fa',
  'Crypto':    '#f59e0b',
  'EV/Tech':   '#fbbf24',
  'Commodity': '#eab308',
  'Index':     '#14b8a6',
  'Bond':      '#94a3b8',
  'REIT':      '#84cc16',
  'Energy':    '#f97316',
};

export const INITIAL_ASSETS = [
  { id: '1', symbol: 'AAPL',  name: 'Apple Inc.',    color: '#60a5fa', sector: 'Tech',    amount: 2500, returns: getReturns('AAPL',  0.0005, 0.015) },
  { id: '2', symbol: 'GOOGL', name: 'Alphabet Inc.', color: '#f87171', sector: 'Tech',    amount: 2500, returns: getReturns('GOOGL', 0.0004, 0.014) },
  { id: '3', symbol: 'TSLA',  name: 'Tesla, Inc.',   color: '#fbbf24', sector: 'EV/Tech', amount: 2500, returns: getReturns('TSLA',  0.0008, 0.030) },
  { id: '4', symbol: 'BTC',   name: 'Bitcoin',       color: '#f59e0b', sector: 'Crypto',  amount: 2500, returns: getReturns('BTC',   0.0010, 0.040) },
];

// SCENARIOS dùng REAL_SHOCKS — fallback về hardcoded nếu mã không có trong data
const HARDCODED_SHOCKS = {
  covid:         { AAPL:-0.32, GOOGL:-0.31, TSLA:-0.61, BTC:-0.50, ETH:-0.55, MSFT:-0.28, AMZN:-0.19, NVDA:-0.35, META:-0.29, GOLD:-0.12 },
  rate_hike:     { AAPL:-0.27, GOOGL:-0.39, TSLA:-0.65, BTC:-0.64, ETH:-0.68, MSFT:-0.28, AMZN:-0.50, NVDA:-0.50, META:-0.64, GOLD:-0.02 },
  bull_run:      { AAPL:0.48,  GOOGL:0.52,  TSLA:0.66,  BTC:1.55,  ETH:0.85,  MSFT:0.56,  AMZN:0.81,  NVDA:2.40,  META:1.94,  GOLD:0.13  },
  stagflation:   { AAPL:-0.18, GOOGL:-0.22, TSLA:-0.30, BTC:-0.20, ETH:-0.25, MSFT:-0.15, AMZN:-0.25, NVDA:-0.20, META:-0.28, GOLD:0.15  },
  crypto_winter: { AAPL:-0.05, GOOGL:-0.07, TSLA:-0.10, BTC:-0.83, ETH:-0.94, MSFT:-0.04, AMZN:-0.08, NVDA:-0.56, META:-0.12, GOLD:0.05  },
};

function buildShocks(eventId, globalShock) {
  const real = REAL_SHOCKS[eventId] ?? {};
  const hard = HARDCODED_SHOCKS[eventId] ?? {};
  // Merge: ưu tiên real data, fallback hardcoded, fallback globalShock
  const all  = {};
  ASSET_CATALOG.forEach(({ symbol }) => {
    all[symbol] = real[symbol] ?? hard[symbol] ?? globalShock;
  });
  return all;
}

export const SCENARIOS = [
  {
    id: 'covid', name: 'COVID Crash', emoji: '🦠',
    description: 'March 2020 market collapse. Tech fell hard, Bitcoin crashed ~40%. TLT bonds gained +10% as a safe haven.',
    color: 'text-red-600', bgColor: 'bg-red-50 border-red-200',
    shocks: buildShocks('covid', -0.30),
    globalShock: -0.30,
  },
  {
    id: 'rate_hike', name: '2022 Rate Hike', emoji: '📈',
    description: 'Fed aggressively raised rates. Growth stocks & crypto crashed. Energy (XOM) surged +79%.',
    color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200',
    shocks: buildShocks('rate_hike', -0.35),
    globalShock: -0.35,
  },
  {
    id: 'bull_run', name: 'Bull Market Run', emoji: '🚀',
    description: '2023 AI-driven rally. NVDA +246%, META +187%, crypto recovered strongly.',
    color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200',
    shocks: buildShocks('bull_run', 0.40),
    globalShock: 0.40,
  },
  {
    id: 'stagflation', name: 'Stagflation Shock', emoji: '⚡',
    description: 'High inflation + slow growth (Q1–Q2 2022). BTC crashed -55%, XOM gained +12%.',
    color: 'text-yellow-600', bgColor: 'bg-yellow-50 border-yellow-200',
    shocks: buildShocks('stagflation', -0.20),
    globalShock: -0.20,
  },
  {
    id: 'crypto_winter', name: 'Crypto Winter', emoji: '❄️',
    description: '2021–2022 crypto collapse. BTC -76%, ETH -76%. Energy stocks soared while tech fell.',
    color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200',
    shocks: buildShocks('crypto_winter', -0.10),
    globalShock: -0.10,
  },
];

export const PRESET_PORTFOLIOS = [
  { name: 'All-Weather', emoji: '🌤️', weights: { AAPL:0.10, GOOGL:0.10, MSFT:0.10, AMZN:0.10, TLT:0.30, GOLD:0.20, BTC:0.05, ETH:0.05 } },
  { name: 'Growth',      emoji: '📈', weights: { AAPL:0.20, GOOGL:0.20, TSLA:0.15, NVDA:0.20, META:0.15, AMZN:0.10 } },
  { name: 'Crypto-Heavy',emoji: '₿',  weights: { BTC:0.40, ETH:0.30, AAPL:0.10, GOOGL:0.10, GOLD:0.10 } },
  { name: 'Conservative',emoji: '🛡️', weights: { TLT:0.40, GOLD:0.25, SPY:0.20, AAPL:0.10, VNQ:0.05 } },
];

/**
 * Build a full asset-array from a preset's weights map.
 * This is the FIX for PortfolioComparison: previously it filtered current
 * portfolio by preset weights, losing assets like TLT/GOLD that weren't in
 * the user's current holdings. Now preset portfolios are constructed
 * independently from the ASSET_CATALOG and always contain their real data.
 */
export function buildPresetAssets(weights) {
  return Object.entries(weights).map(([symbol, w]) => {
    const meta = CATALOG_MAP[symbol];
    if (!meta) return null;
    return {
      symbol,
      name: meta.name,
      color: meta.color,
      sector: meta.sector,
      weight: w,
      returns: getReturns(symbol, meta.drift, meta.vol),
    };
  }).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────
// Centralized risk thresholds — used by RiskMeter, RiskRadar,
// PortfolioAdvisor. Single source of truth so the same daily std-dev
// produces consistent labels (Low/Med/High) everywhere.
//
// Annual std-dev anchors picked from broad-market norms:
//   < 15% — bonds, money-market, balanced funds
//   < 30% — broad equity index, balanced equity portfolio
//   ≥ 30% — single tech stocks, crypto, leveraged plays
//
// Daily equivalents derived from the 252 trading-day annualization
// (annual_std = daily_std × √252). Same number, same boundary, every component.
// ─────────────────────────────────────────────────────────────────────
const SQRT_252 = Math.sqrt(252);
export const VOL_THRESHOLD = {
  ANNUAL_LOW:  0.15,
  ANNUAL_HIGH: 0.30,
  DAILY_LOW:   0.15 / SQRT_252,   // ≈ 0.00945
  DAILY_HIGH:  0.30 / SQRT_252,   // ≈ 0.01890
};

// RiskRadar's "100% on the volatility axis" anchor.
// Set above ANNUAL_HIGH so highly-volatile portfolios (heavy crypto/single-name)
// don't all peg at the outer ring. 50% covers TSLA single-name (~50%), heavy
// BTC mixes (~45%), keeping room for the most extreme cases.
export const RISK_RADAR_VOL_CAP = 0.50;
