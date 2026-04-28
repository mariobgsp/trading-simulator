import { useState, useEffect, useCallback } from 'react';
import type { JournalEntry, PendingOrder, PortfolioState, TickerQuote } from './types';
import { readLocalFile, writeLocalFile } from './github';
import { fetchQuotes, fetchForexRate } from './prices';
import { computePortfolio } from './engine';
import { idr, pct, todayWIB } from './utils';
import TradeModal from './TradeModal';
import PendingOrderModal from './PendingOrderModal';

interface Toast { id: number; msg: string; type: 'success' | 'error' }

function App() {
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioState | null>(null);
  const [quotes, setQuotes] = useState<Map<string, TickerQuote>>(new Map());
  const [liveForex, setLiveForex] = useState(16300);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('');

  const [showTrade, setShowTrade] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [tradeDef, setTradeDef] = useState<{ ticker?: string; action?: 'BUY' | 'SELL' }>({});
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = (msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  };

  // ── Load all data ───────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [j, w, p, forex] = await Promise.all([
        readLocalFile<JournalEntry[]>('journal.json'),
        readLocalFile<string[]>('watchlist.json'),
        readLocalFile<PendingOrder[]>('pending_orders.json'),
        fetchForexRate(),
      ]);
      setJournal(j); setWatchlist(w); setPendingOrders(p); setLiveForex(forex);

      const journalTickers = j.filter(e => !['DEPOSIT', 'WITHDRAW'].includes(e.action)).map(e => e.ticker);
      const activePendingTickers = p.filter(o => o.status === 'ACTIVE').map(o => o.ticker);
      const allTickers = [...new Set([...journalTickers, ...w, ...activePendingTickers])];

      const q = await fetchQuotes(allTickers);
      setQuotes(q);

      const state = computePortfolio(j, q, forex);
      setPortfolio(state);
      setLastUpdate(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Jakarta' }) + ' WIB');
      toast('Data loaded');
    } catch (e: unknown) {
      toast('Load failed: ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Execute trade (save to local journal.json) ──────────
  const executeTrade = async (entry: JournalEntry) => {
    try {
      const updated = [...journal, entry];
      await writeLocalFile('journal.json', updated);
      setJournal(updated);
      const state = computePortfolio(updated, quotes, liveForex);
      setPortfolio(state);
      setShowTrade(false);
      toast(`✅ ${entry.action} ${entry.qty} ${entry.ticker} @ ${entry.price}`);
    } catch (e: unknown) {
      toast('Trade failed: ' + (e instanceof Error ? e.message : String(e)), 'error');
    }
  };

  // ── Create pending order ────────────────────────────────
  const createPendingOrder = async (order: PendingOrder) => {
    try {
      const updated = [...pendingOrders, order];
      await writeLocalFile('pending_orders.json', updated);
      setPendingOrders(updated);
      setShowPending(false);
      toast(`📋 Pending: ${order.ticker} @ ${order.trigger_price}`);
    } catch (e: unknown) {
      toast('Failed: ' + (e instanceof Error ? e.message : String(e)), 'error');
    }
  };

  // ── Cancel pending order ────────────────────────────────
  const cancelPendingOrder = async (id: string) => {
    try {
      const updated = pendingOrders.map(o => o.id === id ? { ...o, status: 'CANCELLED' as const } : o);
      await writeLocalFile('pending_orders.json', updated);
      setPendingOrders(updated);
      toast('Order cancelled');
    } catch (e: unknown) {
      toast('Failed: ' + (e instanceof Error ? e.message : String(e)), 'error');
    }
  };

  // ── Check pending order triggers ────────────────────────
  const checkPendingTriggers = useCallback(async () => {
    const active = pendingOrders.filter(o => o.status === 'ACTIVE');
    const triggered: { order: PendingOrder; entry: JournalEntry }[] = [];

    for (const order of active) {
      const q = quotes.get(order.ticker);
      if (!q || q.current_price == null) continue;
      const price = q.current_price;
      let hit = false;
      if (order.condition === 'PRICE_AT_OR_BELOW' && price <= order.trigger_price) hit = true;
      if (order.condition === 'PRICE_AT_OR_ABOVE' && price >= order.trigger_price) hit = true;
      if (hit) {
        triggered.push({
          order,
          entry: {
            date: todayWIB(), ticker: order.ticker, action: order.action,
            qty: order.qty, price: order.trigger_price, currency: order.currency,
            sl_price: order.sl_price, tp_price: order.tp_price, trailing_stop_pct: order.trailing_stop_pct,
            reason: `Pending filled: ${order.condition} @ ${order.trigger_price}`,
            system_generated: true,
          },
        });
      }
    }
    if (triggered.length === 0) return;

    try {
      const newJournal = [...journal, ...triggered.map(t => t.entry)];
      const newPending = pendingOrders.map(o => {
        const t = triggered.find(x => x.order.id === o.id);
        return t ? { ...o, status: 'FILLED' as const, filled_at: t.entry.date, filled_price: t.entry.price } : o;
      });
      await Promise.all([
        writeLocalFile('journal.json', newJournal),
        writeLocalFile('pending_orders.json', newPending),
      ]);
      setJournal(newJournal); setPendingOrders(newPending);
      const state = computePortfolio(newJournal, quotes, liveForex);
      setPortfolio(state);
      for (const t of triggered) toast(`🎯 Filled: ${t.entry.action} ${t.entry.qty} ${t.entry.ticker}`);
    } catch (e: unknown) {
      toast('Auto-fill failed: ' + (e instanceof Error ? e.message : String(e)), 'error');
    }
  }, [pendingOrders, quotes, journal, liveForex]);

  useEffect(() => { if (quotes.size > 0) checkPendingTriggers(); }, [quotes.size]); // eslint-disable-line

  // ── Watchlist management ────────────────────────────────
  const addToWatchlist = async (ticker: string) => {
    if (watchlist.includes(ticker)) {
      toast(`${ticker} is already in watchlist`, 'error');
      return;
    }
    try {
      const updated = [...watchlist, ticker];
      await writeLocalFile('watchlist.json', updated);
      setWatchlist(updated);
      
      const q = await fetchQuotes([...Array.from(quotes.keys()), ticker]);
      setQuotes(q);
      
      toast(`Added ${ticker} to watchlist`);
    } catch (e: unknown) {
      toast('Failed to add: ' + (e instanceof Error ? e.message : String(e)), 'error');
    }
  };

  const removeFromWatchlist = async (ticker: string) => {
    try {
      const updated = watchlist.filter(t => t !== ticker);
      await writeLocalFile('watchlist.json', updated);
      setWatchlist(updated);
      toast(`Removed ${ticker} from watchlist`);
    } catch (e: unknown) {
      toast('Failed to remove: ' + (e instanceof Error ? e.message : String(e)), 'error');
    }
  };

  const ps = portfolio;
  const activeOrders = pendingOrders.filter(o => o.status === 'ACTIVE');
  const filledOrders = pendingOrders.filter(o => o.status !== 'ACTIVE');

  return (
    <div className="app">
      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}
      </div>

      {/* Top bar */}
      <div className="top-bar">
        <div>
          <div className="logo">📈 Trading Simulator</div>
          <div className="timestamp">{lastUpdate || (loading ? 'Loading…' : 'Ready')}</div>
        </div>
        <div className="top-actions">
          <button className="btn btn-green" onClick={() => { setTradeDef({ action: 'BUY' }); setShowTrade(true); }}>+ Buy</button>
          <button className="btn btn-red" onClick={() => { setTradeDef({ action: 'SELL' }); setShowTrade(true); }}>− Sell</button>
          <button className="btn" onClick={() => setShowPending(true)}>📋 Pending Order</button>
          <button className="btn" onClick={() => {
            const amtStr = window.prompt("Enter topup amount (IDR):");
            if (!amtStr) return;
            const amt = parseFloat(amtStr);
            if (isNaN(amt) || amt <= 0) {
              toast("Invalid amount", "error");
              return;
            }
            executeTrade({
              date: todayWIB(),
              ticker: 'CASH',
              action: 'DEPOSIT',
              qty: 1,
              price: amt,
              currency: 'IDR',
              sl_price: 0,
              tp_price: 0,
              trailing_stop_pct: 0,
              reason: 'Manual topup',
              system_generated: false,
            });
          }}>💰 Topup</button>
          <button className="btn" onClick={loadAll} disabled={loading}>{loading ? '⟳' : '↻'} Refresh</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="summary-grid">
        <div className="card summary-card fade-in">
          <div className="icon icon-cash">💰</div>
          <div className="card-title">Liquid Cash</div>
          <div className="value">{ps ? idr(ps.cash_idr) : '—'}</div>
        </div>
        <div className="card summary-card fade-in">
          <div className="icon icon-portfolio">📊</div>
          <div className="card-title">Portfolio Value</div>
          <div className="value">{ps ? idr(ps.total_portfolio_value_idr) : '—'}</div>
        </div>
        <div className="card summary-card fade-in">
          <div className="icon icon-gains">⚡</div>
          <div className="card-title">Realized Gains</div>
          <div className={`value ${ps && ps.total_realized_pnl_idr >= 0 ? 'pnl-pos' : 'pnl-neg'}`}>
            {ps ? idr(ps.total_realized_pnl_idr) : '—'}
          </div>
          <div className="sub">{ps ? `${ps.realized_trades.length} closed trade(s)` : ''}</div>
        </div>
        <div className="card summary-card fade-in">
          <div className="icon icon-forex">🌐</div>
          <div className="card-title">USD / IDR Rate</div>
          <div className="value">Rp {Math.round(liveForex).toLocaleString('id-ID')}</div>
          <div className="sub">{ps ? 'Net Worth: ' + idr(ps.net_worth_idr) : ''}</div>
        </div>
      </div>

      {/* Main grid */}
      <div className="main-grid">
        <div className="main-col">
          {/* Active Portfolio */}
          <div className="card fade-in">
            <div className="card-title">Active Portfolio</div>
            {!ps || ps.positions.length === 0 ? (
              <div className="empty">No active positions</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Ticker</th><th>Qty</th><th>Avg Buy</th><th>Current</th><th>Value (IDR)</th><th>PnL</th><th></th></tr></thead>
                  <tbody>
                    {ps.positions.map(p => (
                      <tr key={p.ticker}>
                        <td className="ticker-name">{p.ticker}</td>
                        <td className="mono">{p.qty}</td>
                        <td className="mono">{p.avg_buy_price_native?.toLocaleString('en-US')}<br /><span style={{ color: 'var(--text3)', fontSize: '.68rem' }}>{idr(p.avg_buy_price_idr)}</span></td>
                        <td className="mono">{p.current_price_native?.toLocaleString('en-US') ?? '—'}<br /><span style={{ color: 'var(--text3)', fontSize: '.68rem' }}>{idr(p.current_price_idr)}</span></td>
                        <td className="mono">{idr(p.total_value_idr)}</td>
                        <td className={`mono ${p.unrealized_pnl_idr >= 0 ? 'pnl-pos' : 'pnl-neg'}`}>
                          {idr(p.unrealized_pnl_idr)}<br />
                          <span className={`badge ${p.unrealized_pnl_pct >= 0 ? 'badge-green' : 'badge-red'}`}>{pct(p.unrealized_pnl_pct)}</span>
                        </td>
                        <td><button className="btn btn-red btn-sm" onClick={() => { setTradeDef({ ticker: p.ticker, action: 'SELL' }); setShowTrade(true); }}>Sell</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pending Orders */}
          {activeOrders.length > 0 && (
            <div className="card fade-in">
              <div className="card-title">📋 Active Pending Orders</div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Ticker</th><th>Action</th><th>Condition</th><th>Trigger</th><th>Qty</th><th>Created</th><th></th></tr></thead>
                  <tbody>
                    {activeOrders.map(o => (
                      <tr key={o.id}>
                        <td className="ticker-name">{o.ticker}</td>
                        <td><span className={`badge ${o.action === 'BUY' ? 'badge-green' : 'badge-red'}`}>{o.action}</span></td>
                        <td className="mono" style={{ fontSize: '.7rem' }}>{o.condition === 'PRICE_AT_OR_BELOW' ? '≤ Support' : '≥ Breakout'}</td>
                        <td className="mono">{o.trigger_price.toLocaleString('en-US')} {o.currency}</td>
                        <td className="mono">{o.qty}</td>
                        <td className="mono">{o.created_at}</td>
                        <td><button className="btn btn-sm" onClick={() => cancelPendingOrder(o.id)}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Capital Gains */}
          <div className="card fade-in">
            <div className="card-title">Capital Gains — Closed Trades</div>
            {!ps || ps.realized_trades.length === 0 ? (
              <div className="empty">No closed trades yet</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Ticker</th><th>Qty</th><th>Sell Price</th><th>Cost Basis</th><th>PnL (IDR)</th></tr></thead>
                  <tbody>
                    {ps.realized_trades.map((t, i) => (
                      <tr key={i}>
                        <td className="mono">{t.date}</td>
                        <td className="ticker-name">{t.ticker}{t.system_generated && <span className="bot-tag">BOT</span>}</td>
                        <td className="mono">{t.qty}</td>
                        <td className="mono">{t.sell_price_native?.toLocaleString('en-US')} {t.currency}</td>
                        <td className="mono">{idr(t.cost_basis_idr)}</td>
                        <td className={`mono ${t.realized_pnl_idr >= 0 ? 'pnl-pos' : 'pnl-neg'}`}>{idr(t.realized_pnl_idr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="main-col">
          <div className="card fade-in">
            <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Watchlist
              <button className="btn btn-sm" onClick={() => {
                const ticker = window.prompt("Enter ticker symbol (e.g. AAPL, BBCA.JK):");
                if (ticker && ticker.trim()) {
                  addToWatchlist(ticker.trim().toUpperCase());
                }
              }}>+</button>
            </div>
            {watchlist.length === 0 ? <div className="empty">Watchlist empty</div> : (
              <>
                {watchlist.map(ticker => {
                  const q = quotes.get(ticker);
                  const chg = q?.daily_change_pct;
                  const cur = q?.currency || 'IDR';
                  const priceIDR = q?.current_price != null ? (cur === 'IDR' ? q.current_price : q.current_price * liveForex) : null;
                  return (
                    <div className="watch-item" key={ticker}>
                      <div>
                        <div className="watch-ticker">{ticker}</div>
                        <div className="watch-price">{priceIDR != null ? idr(priceIDR) : '—'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div className="watch-price">{q?.current_price?.toLocaleString('en-US') ?? '—'} {cur !== 'IDR' ? cur : ''}</div>
                          <div className={`watch-change ${chg != null ? (chg >= 0 ? 'pnl-pos' : 'pnl-neg') : ''}`}>{pct(chg)}</div>
                        </div>
                        <button 
                          className="btn btn-sm btn-red" 
                          onClick={() => removeFromWatchlist(ticker)}
                          style={{ padding: '2px 6px', fontSize: '0.7rem', height: 'fit-content' }}
                        >✕</button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {filledOrders.length > 0 && (
            <div className="card fade-in">
              <div className="card-title">Order History</div>
              {filledOrders.slice(-10).reverse().map(o => (
                <div className="watch-item" key={o.id} style={{ fontSize: '.78rem' }}>
                  <div>
                    <div className="ticker-name">{o.ticker}</div>
                    <div className="watch-price">{o.action} @ {o.trigger_price}</div>
                  </div>
                  <span className={`badge ${o.status === 'FILLED' ? 'badge-green' : 'badge-muted'}`}>{o.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showTrade && (
        <TradeModal
          quotes={quotes} liveForex={liveForex}
          positions={ps?.positions.map(p => ({ ticker: p.ticker, qty: p.qty, native_currency: p.native_currency })) || []}
          onSubmit={executeTrade} onClose={() => setShowTrade(false)}
          defaultTicker={tradeDef.ticker} defaultAction={tradeDef.action}
        />
      )}
      {showPending && (
        <PendingOrderModal
          quotes={quotes} liveForex={liveForex}
          onSubmit={createPendingOrder} onClose={() => setShowPending(false)}
        />
      )}
    </div>
  );
}

export default App;
