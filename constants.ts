export function CORRELATION_INTERPRETATION(r: number): { description: string } {
  const a = Math.abs(r);
  if (a > 0.9) return { description: 'These assets move almost perfectly in sync.' };
  if (a > 0.7) return { description: 'They follow each other closely most of the time.' };
  if (a > 0.4) return { description: 'A noticeable relationship, but they often diverge.' };
  if (a > 0.2) return { description: 'The relationship is slight and unreliable.' };
  return { description: 'These assets move independently of each other.' };
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  color: string;
  weight: number;
  returns: number[];
}

export function generateMockReturns(drift: number, volatility: number, days: number): number[] {
  const returns = [];
  let price = 100;
  for (let i = 0; i < days; i++) {
    const dailyReturn = drift + volatility * (Math.random() - 0.5) * 2;
    price *= (1 + dailyReturn);
    returns.push(dailyReturn);
  }
  return returns;
}

export const INITIAL_ASSETS: Asset[] = [
  { id: '1', symbol: 'AAPL',  name: 'Apple Inc.',     color: '#60a5fa', weight: 0.25, returns: generateMockReturns(0.0005, 0.015, 60) },
  { id: '2', symbol: 'GOOGL', name: 'Alphabet Inc.',  color: '#f87171', weight: 0.25, returns: generateMockReturns(0.0004, 0.014, 60) },
  { id: '3', symbol: 'TSLA',  name: 'Tesla, Inc.',    color: '#fbbf24', weight: 0.25, returns: generateMockReturns(0.0008, 0.030, 60) },
  { id: '4', symbol: 'BTC',   name: 'Bitcoin',        color: '#f59e0b', weight: 0.25, returns: generateMockReturns(0.0010, 0.040, 60) },
];