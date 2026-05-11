import { useState, useEffect } from 'react';
import { fetchWatchlistGroups, fetchWatchlist } from './stockbit';

interface Props {
  localWatchlist: string[];
  selectedTicker: string | null;
  onSelect: (ticker: string) => void;
}

export default function StockbitWatchlist({ localWatchlist, selectedTicker, onSelect }: Props) {
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<'stockbit' | 'local'>('stockbit');

  // Load groups
  useEffect(() => {
    fetchWatchlistGroups()
      .then(g => {
        setGroups(g);
        const def = g.find((x: any) => x.is_default) || g[0];
        if (def) setSelectedGroup(def.watchlist_id);
      })
      .catch(() => {
        // If stockbit fails, fallback to local
        setSource('local');
      });
  }, []);

  // Load items when group changes
  useEffect(() => {
    if (source !== 'stockbit' || !selectedGroup) return;
    setLoading(true);
    fetchWatchlist(selectedGroup)
      .then(d => {
        const result = d?.data?.result || [];
        setItems(result);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [selectedGroup, source]);

  const displayItems = source === 'stockbit'
    ? items.filter(it => {
        if (!search) return true;
        const s = search.toUpperCase();
        return (it.symbol || it.company_code || '').toUpperCase().includes(s) ||
               (it.company_name || '').toUpperCase().includes(s);
      })
    : localWatchlist.filter(t => !search || t.toUpperCase().includes(search.toUpperCase()));

  return (
    <>
      <div className="sidebar-header">
        <div className="sidebar-title">Watchlist</div>
        <div className="date-range-btns">
          <button className={`date-range-btn ${source === 'stockbit' ? 'active' : ''}`} onClick={() => setSource('stockbit')} style={{ fontSize: '.58rem' }}>SB</button>
          <button className={`date-range-btn ${source === 'local' ? 'active' : ''}`} onClick={() => setSource('local')} style={{ fontSize: '.58rem' }}>Local</button>
        </div>
      </div>

      {source === 'stockbit' && groups.length > 1 && (
        <div style={{ padding: '6px 12px 0' }}>
          <select
            value={selectedGroup || ''}
            onChange={e => setSelectedGroup(Number(e.target.value))}
            style={{
              width: '100%', padding: '5px 8px', fontSize: '.72rem',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text)', outline: 'none', cursor: 'pointer'
            }}
          >
            {groups.map((g: any) => (
              <option key={g.watchlist_id} value={g.watchlist_id}>{g.emoji || ''} {g.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="sidebar-search">
        <input placeholder="Search ticker..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="sidebar-list">
        {loading && <div style={{ textAlign: 'center', padding: 20 }}><div className="spinner" /></div>}

        {!loading && displayItems.length === 0 && (
          <div className="empty">No items</div>
        )}

        {!loading && source === 'stockbit' && (displayItems as any[]).map((it, i) => {
          const ticker = it.symbol || it.company_code;
          const pctVal = parseFloat(it.percent) || 0;
          const isPos = pctVal >= 0;
          const isSelected = selectedTicker === ticker;
          return (
            <div className={`watch-item ${isSelected ? 'selected' : ''}`} key={it.id || i} onClick={() => onSelect(ticker)}>
              <div>
                <div className="watch-ticker">{ticker}</div>
                <div className="watch-sector">{it.sector || it.company_name || ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="watch-price">{it.last_price?.toLocaleString() || '-'}</div>
                <div className={`watch-change ${isPos ? 'pnl-pos' : 'pnl-neg'}`} style={{ fontSize: '.68rem' }}>
                  {isPos ? '+' : ''}{it.percent || '0'}%
                </div>
              </div>
            </div>
          );
        })}

        {!loading && source === 'local' && (displayItems as string[]).map(ticker => {
          const isSelected = selectedTicker === ticker;
          return (
            <div className={`watch-item ${isSelected ? 'selected' : ''}`} key={ticker} onClick={() => onSelect(ticker)}>
              <div><div className="watch-ticker">{ticker}</div></div>
            </div>
          );
        })}
      </div>
    </>
  );
}
