import type { TickerQuote } from './types';

/**
 * Fetch quote via the Vite dev-server proxy to Yahoo Finance.
 * The proxy at /api/yahoo/* forwards to query1.finance.yahoo.com/*
 * completely bypassing CORS — works 100% locally.
 */
export async function fetchQuote(ticker: string): Promise<TickerQuote> {
  const url = `/api/yahoo/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Yahoo ${ticker}: HTTP ${r.status}`);

  const json = await r.json();
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`No data for ${ticker}`);

  const meta = result.meta;
  const quotes = result.indicators?.quote?.[0];
  const closes: number[] = (quotes?.close || []).filter((v: number | null) => v != null);

  const currentPrice = meta.regularMarketPrice ?? closes[closes.length - 1] ?? null;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? (closes.length >= 2 ? closes[closes.length - 2] : null);
  let changePct: number | null = null;
  if (currentPrice != null && prevClose != null && prevClose !== 0) {
    changePct = Math.round(((currentPrice - prevClose) / prevClose) * 10000) / 100;
  }

  return {
    ticker,
    current_price: currentPrice,
    previous_close: prevClose,
    daily_change_pct: changePct,
    currency: meta.currency || 'USD',
    high: quotes?.high?.filter((v: number | null) => v != null).pop() ?? null,
    low: quotes?.low?.filter((v: number | null) => v != null).pop() ?? null,
  };
}

/** Fetch USD→IDR exchange rate. */
export async function fetchForexRate(): Promise<number> {
  try {
    const q = await fetchQuote('USDIDR=X');
    return q.current_price ?? 16300;
  } catch {
    return 16300;
  }
}

/** Fetch quotes for multiple tickers in parallel. */
export async function fetchQuotes(tickers: string[]): Promise<Map<string, TickerQuote>> {
  const map = new Map<string, TickerQuote>();
  const results = await Promise.allSettled(tickers.map(t => fetchQuote(t)));
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') map.set(tickers[i], r.value);
  });
  return map;
}
