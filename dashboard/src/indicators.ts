export interface OHLCV {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  value: number; // Volume
}

export interface Point {
  time: string;
  value: number;
}

/** 
 * Calculate RSI (Relative Strength Index)
 * 14-period Wilder's Smoothing by default 
 */
export function calculateRSI(data: OHLCV[], period: number = 14): Point[] {
  if (data.length <= period) return [];
  const result: Point[] = [];
  
  let sumGain = 0;
  let sumLoss = 0;

  // Initial SMA for first period
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) sumGain += change;
    else sumLoss -= change;
  }
  
  let avgGain = sumGain / period;
  let avgLoss = sumLoss / period;
  
  const rs = avgGain / (avgLoss === 0 ? 1e-10 : avgLoss);
  let rsi = 100 - (100 / (1 + rs));
  result.push({ time: data[period].time, value: rsi });

  // Smoothed Moving Average (Wilder's)
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    let gain = 0;
    let loss = 0;
    if (change > 0) gain = change;
    else loss = -change;
    
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    
    const rs = avgGain / (avgLoss === 0 ? 1e-10 : avgLoss);
    rsi = 100 - (100 / (1 + rs));
    result.push({ time: data[i].time, value: rsi });
  }

  return result;
}

/** 
 * Calculate Stochastic Oscillator %K
 */
export function calculateStochastic(data: OHLCV[], period: number = 14): Point[] {
  if (data.length < period) return [];
  const result: Point[] = [];

  for (let i = period - 1; i < data.length; i++) {
    const window = data.slice(i - period + 1, i + 1);
    const highestHigh = Math.max(...window.map(d => d.high));
    const lowestLow = Math.min(...window.map(d => d.low));
    
    const currentClose = data[i].close;
    
    let k = 0;
    if (highestHigh !== lowestLow) {
      k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    } else {
      k = 50;
    }
    
    result.push({ time: data[i].time, value: k });
  }
  return result;
}

/** 
 * Calculate MFI (Money Flow Index)
 */
export function calculateMFI(data: OHLCV[], period: number = 14): Point[] {
  if (data.length <= period) return [];
  const result: Point[] = [];
  
  const typicalPrices = data.map(d => (d.high + d.low + d.close) / 3);
  const rawMoneyFlow = data.map((d, i) => typicalPrices[i] * d.value);
  
  for (let i = period; i < data.length; i++) {
    let positiveFlow = 0;
    let negativeFlow = 0;
    
    for (let j = i - period + 1; j <= i; j++) {
      if (typicalPrices[j] > typicalPrices[j - 1]) {
        positiveFlow += rawMoneyFlow[j];
      } else if (typicalPrices[j] < typicalPrices[j - 1]) {
        negativeFlow += rawMoneyFlow[j];
      }
    }
    
    const moneyFlowRatio = positiveFlow / (negativeFlow === 0 ? 1e-10 : negativeFlow);
    const mfi = 100 - (100 / (1 + moneyFlowRatio));
    
    result.push({ time: data[i].time, value: mfi });
  }
  
  return result;
}

/**
 * Calculate CFI (Cumulative Flow Indicator) or Cumulative Accumulation
 * Simply computes a running total of the daily net flow values.
 */
export function calculateCFI(dates: string[], dailyFlows: number[]): Point[] {
  if (dates.length !== dailyFlows.length || dates.length === 0) return [];
  
  const result: Point[] = [];
  let cumulative = 0;
  
  for (let i = 0; i < dates.length; i++) {
    cumulative += dailyFlows[i];
    result.push({ time: dates[i], value: cumulative });
  }
  
  return result;
}

/**
 * Align two arrays of Points by their time (filling gaps with previous values or 0)
 * Useful to merge charting datasets
 */
export function alignData<T extends {time: string}>(primary: T[], secondary: {time: string, value: number}[]): {time: string, value: number}[] {
  const result: {time: string, value: number}[] = [];
  const secMap = new Map(secondary.map(s => [s.time, s.value]));
  
  let lastVal = 0;
  for (const p of primary) {
    if (secMap.has(p.time)) {
      lastVal = secMap.get(p.time)!;
    }
    result.push({ time: p.time, value: lastVal });
  }
  return result;
}
