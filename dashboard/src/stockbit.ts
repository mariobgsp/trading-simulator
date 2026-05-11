/**
 * Stockbit API client for the web dashboard.
 * Uses the Vite dev server proxy at /api/stockbit to bypass CORS
 * and inject the STOCKBIT_JWT_TOKEN securely.
 */

const BASE_URL = '/api/stockbit';

export async function fetchMarketDetector(emiten: string, fromDate: string, toDate: string): Promise<any> {
  const url = new URL(`${BASE_URL}/marketdetectors/${emiten}`, window.location.origin);
  url.searchParams.append('from', fromDate);
  url.searchParams.append('to', toDate);
  url.searchParams.append('transaction_type', 'TRANSACTION_TYPE_NET');
  url.searchParams.append('market_board', 'MARKET_BOARD_REGULER');
  url.searchParams.append('investor_type', 'INVESTOR_TYPE_ALL');
  url.searchParams.append('limit', '25');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'accept': 'application/json' },
  });

  if (!response.ok) throw new Error(`Stockbit Market Detector API error: ${response.status}`);
  return response.json();
}

export async function fetchOrderbook(emiten: string): Promise<any> {
  const url = `${BASE_URL}/company-price-feed/v2/orderbook/companies/${emiten}`;
  const response = await fetch(url, { method: 'GET', headers: { 'accept': 'application/json' } });
  if (!response.ok) throw new Error(`Orderbook API error: ${response.status}`);
  return response.json();
}

export async function fetchEmitenInfo(emiten: string): Promise<any> {
  const url = `${BASE_URL}/emitten/${emiten}/info`;
  const response = await fetch(url, { method: 'GET', headers: { 'accept': 'application/json' } });
  if (!response.ok) throw new Error(`Emiten Info API error: ${response.status}`);
  return response.json();
}

export async function fetchSectors(): Promise<string[]> {
  const url = `${BASE_URL}/emitten/sectors`;
  const response = await fetch(url, { method: 'GET', headers: { 'accept': 'application/json' } });
  if (!response.ok) throw new Error(`Sectors API error: ${response.status}`);
  const data = await response.json();
  return (data.data || []).map((item: { name: string }) => item.name).filter(Boolean);
}

export async function fetchWatchlistGroups(): Promise<any[]> {
  const url = `${BASE_URL}/watchlist?page=1&limit=500`;
  const response = await fetch(url, { method: 'GET', headers: { 'accept': 'application/json' } });
  if (!response.ok) throw new Error(`Watchlist Groups API error: ${response.status}`);
  const json = await response.json();
  return Array.isArray(json.data) ? json.data : [];
}

export async function fetchWatchlist(watchlistId?: number): Promise<any> {
  let id = watchlistId;
  if (!id) {
    const groups = await fetchWatchlistGroups();
    const defaultGroup = groups.find((w: any) => w.is_default) || groups[0];
    id = defaultGroup?.watchlist_id;
    if (!id) throw new Error('No watchlist found');
  }

  const detailUrl = `${BASE_URL}/watchlist/${id}?page=1&limit=500`;
  const response = await fetch(detailUrl, { method: 'GET', headers: { 'accept': 'application/json' } });
  if (!response.ok) throw new Error(`Watchlist Detail API error: ${response.status}`);
  
  const json = await response.json();
  if (json.data?.result) {
    json.data.result = json.data.result.map((item: any) => ({
      ...item,
      company_code: item.symbol || item.company_code
    }));
  }
  return json;
}

export async function fetchKeyStats(emiten: string): Promise<any> {
  const url = `${BASE_URL}/keystats/ratio/v1/${emiten}?year_limit=10`;
  const response = await fetch(url, { method: 'GET', headers: { 'accept': 'application/json' } });
  if (!response.ok) throw new Error(`KeyStats API error: ${response.status}`);
  
  const json = await response.json();
  const categories = json.data?.closure_fin_items_results || [];
  
  const findCategory = (name: string) => {
    const category = categories.find((c: any) => c.keystats_name === name);
    if (!category) return [];
    return category.fin_name_results.map((r: any) => r.fitem);
  };

  return {
    currentValuation: findCategory('Current Valuation'),
    incomeStatement: findCategory('Income Statement'),
    balanceSheet: findCategory('Balance Sheet'),
    profitability: findCategory('Profitability'),
    growth: findCategory('Growth'),
  };
}

export async function fetchHistoricalSummary(
  emiten: string,
  startDate: string,
  endDate: string,
  limit: number = 12
): Promise<any[]> {
  const url = `${BASE_URL}/company-price-feed/historical/summary/${emiten}?period=HS_PERIOD_DAILY&start_date=${startDate}&end_date=${endDate}&limit=${limit}&page=1`;
  const response = await fetch(url, { method: 'GET', headers: { 'accept': 'application/json' } });
  if (!response.ok) throw new Error(`Historical Summary API error: ${response.status}`);
  const json = await response.json();
  return json.data?.result || [];
}

export async function deleteWatchlistItem(watchlistId: number, companyId: number): Promise<void> {
  const url = `${BASE_URL}/watchlist/${watchlistId}/company/${companyId}/item`;
  const response = await fetch(url, { method: 'DELETE', headers: { 'accept': 'application/json' } });
  if (!response.ok) throw new Error(`Delete Watchlist Item API error: ${response.status}`);
}

export function getTopBroker(marketDetectorData: any): any | null {
  const brokers = marketDetectorData?.data?.broker_summary?.brokers_buy;
  if (!brokers || !Array.isArray(brokers) || brokers.length === 0) return null;
  const topBroker = [...brokers].sort((a, b) => Number(b.bval) - Number(a.bval))[0];
  return {
    bandar: topBroker.netbs_broker_code,
    barangBandar: Math.round(Number(topBroker.blot)),
    rataRataBandar: Math.round(Number(topBroker.netbs_buy_avg_price)),
  };
}

export function getBrokerSummary(marketDetectorData: any): any {
  const detector = marketDetectorData?.data?.bandar_detector;
  const brokerSummary = marketDetectorData?.data?.broker_summary;
  return {
    detector: {
      top1: detector?.top1 || { vol: 0, percent: 0, amount: 0, accdist: '-' },
      top3: detector?.top3 || { vol: 0, percent: 0, amount: 0, accdist: '-' },
      top5: detector?.top5 || { vol: 0, percent: 0, amount: 0, accdist: '-' },
      avg: detector?.avg || { vol: 0, percent: 0, amount: 0, accdist: '-' },
      total_buyer: detector?.total_buyer || 0,
      total_seller: detector?.total_seller || 0,
      number_broker_buysell: detector?.number_broker_buysell || 0,
      broker_accdist: detector?.broker_accdist || '-',
      volume: detector?.volume || 0,
      value: detector?.value || 0,
      average: detector?.average || 0,
    },
    topBuyers: brokerSummary?.brokers_buy?.slice(0, 4) || [],
    topSellers: brokerSummary?.brokers_sell?.slice(0, 4) || [],
  };
}

/** Fetch active trade data — recent daily trading activity for a ticker */
export async function fetchActiveTrade(emiten: string, days: number = 10): Promise<any[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days + 5)); // extra buffer for weekends
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return fetchHistoricalSummary(emiten, fmt(start), fmt(end), days);
}

/** Fetch Stockbit community stream / news for a ticker */
export async function fetchStockbitNews(emiten: string): Promise<any[]> {
  try {
    const url = `${BASE_URL}/stream/stocks/${emiten}?page=1&limit=15`;
    const response = await fetch(url, { method: 'GET', headers: { 'accept': 'application/json' } });
    if (!response.ok) return [];
    const json = await response.json();
    const posts = json.data?.stream || json.data || [];
    return Array.isArray(posts) ? posts.slice(0, 15) : [];
  } catch {
    return [];
  }
}

/** Fetch IDX news from Stockbit's news endpoint */
export async function fetchIdxNews(): Promise<any[]> {
  try {
    const url = `${BASE_URL}/news?page=1&limit=20`;
    const response = await fetch(url, { method: 'GET', headers: { 'accept': 'application/json' } });
    if (!response.ok) return [];
    const json = await response.json();
    return Array.isArray(json.data) ? json.data.slice(0, 20) : [];
  } catch {
    return [];
  }
}

/** Fetch daily broker flow / bandarmology from tradersaham API */
export async function fetchBrokerFlowDaily(emiten: string, days: number = 60): Promise<any> {
  try {
    const url = `/api/tradersaham/api/market-insight/broker-intelligence?limit=100&page=1&sort_by=consistency&mode=accum&lookback_days=${days}&broker_status=Bandar,Whale,Retail,Mix&search=${emiten.toLowerCase()}`;
    const response = await fetch(url, { method: 'GET', headers: { 'accept': 'application/json' } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}


