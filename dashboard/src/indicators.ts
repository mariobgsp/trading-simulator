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

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(data: OHLCV[]): { time: string; macd: number; signal: number; histogram: number }[] {
  if (data.length < 26) return [];
  
  const calculateEMA = (values: number[], period: number) => {
    const k = 2 / (period + 1);
    const ema = [values[0]];
    for (let i = 1; i < values.length; i++) {
      ema.push(values[i] * k + ema[i - 1] * (1 - k));
    }
    return ema;
  };

  const closes = data.map(d => d.close);
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calculateEMA(macdLine, 9);
  
  return data.map((d, i) => ({
    time: d.time,
    macd: macdLine[i],
    signal: signalLine[i],
    histogram: macdLine[i] - signalLine[i]
  }));
}

/**
 * Calculate Full Stochastic Oscillator (%K and %D)
 */
export function calculateStochasticFull(data: OHLCV[], period: number = 14, smoothK: number = 3, smoothD: number = 3): { time: string; k: number; d: number }[] {
  const result: { time: string; k: number; d: number }[] = [];
  if (data.length < period) return result;

  const rawK: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const window = data.slice(i - period + 1, i + 1);
    const highestHigh = Math.max(...window.map(d => d.high));
    const lowestLow = Math.min(...window.map(d => d.low));
    const currentClose = data[i].close;
    
    let k = 50;
    if (highestHigh !== lowestLow) {
      k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    }
    rawK.push(k);
  }

  // Simple Moving Average for smoothing
  const sma = (values: number[], period: number, index: number) => {
    if (index < period - 1) return values[index];
    let sum = 0;
    for (let i = 0; i < period; i++) sum += values[index - i];
    return sum / period;
  };

  const smoothKLine = rawK.map((_, i) => sma(rawK, smoothK, i));
  const smoothDLine = smoothKLine.map((_, i) => sma(smoothKLine, smoothD, i));

  for (let i = 0; i < rawK.length; i++) {
    result.push({
      time: data[i + period - 1].time,
      k: smoothKLine[i],
      d: smoothDLine[i]
    });
  }

  return result;
}
