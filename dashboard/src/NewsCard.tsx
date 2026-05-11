import { useState, useEffect } from 'react';
import { fetchStockbitNews, fetchIdxNews } from './stockbit';

interface Props { emiten?: string }

export default function NewsCard({ emiten }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'ticker' | 'market'>('market');

  useEffect(() => {
    setLoading(true);
    const doFetch = async () => {
      try {
        if (mode === 'ticker' && emiten) {
          const data = await fetchStockbitNews(emiten);
          setItems(data);
        } else {
          const data = await fetchIdxNews();
          setItems(data);
        }
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    doFetch();
  }, [emiten, mode]);

  // Auto-switch to ticker mode when emiten is selected
  useEffect(() => {
    if (emiten) setMode('ticker');
    else setMode('market');
  }, [emiten]);

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      const now = Date.now();
      const diff = now - d.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch { return ts; }
  };

  const stripHtml = (html: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim().slice(0, 200);
  };

  return (
    <div className="card fade-in" id="news-card">
      <div className="card-header">
        <div className="card-title" style={{ margin: 0 }}>📰 {mode === 'ticker' && emiten ? `News — ${emiten}` : 'Market News'}</div>
        {emiten && (
          <div className="date-range-btns">
            <button className={`date-range-btn ${mode === 'ticker' ? 'active' : ''}`} onClick={() => setMode('ticker')}>{emiten}</button>
            <button className={`date-range-btn ${mode === 'market' ? 'active' : ''}`} onClick={() => setMode('market')}>Market</button>
          </div>
        )}
      </div>

      {loading && <div className="spinner" style={{ margin: '16px auto', display: 'block' }} />}
      
      {!loading && items.length === 0 && <div className="empty">No news available</div>}

      {!loading && items.map((item, i) => {
        // Stockbit stream format
        const title = item.title || item.body?.split('\n')[0] || item.content?.split('\n')[0] || 'Untitled';
        const body = item.body || item.content || item.description || '';
        const time = item.created_at || item.published_at || item.timestamp || '';
        const author = item.user?.username || item.source || '';
        const url = item.url || item.link || '';

        return (
          <div className="news-item" key={i}>
            <div className="news-title">
              {url ? <a href={url} target="_blank" rel="noopener noreferrer">{stripHtml(title)}</a> : stripHtml(title)}
            </div>
            <div className="news-meta">
              {author && <span>@{author}</span>}
              {time && <span>{formatTime(time)}</span>}
            </div>
            {body && title !== body && (
              <div className="news-snippet">{stripHtml(body).slice(0, 150)}{stripHtml(body).length > 150 ? '…' : ''}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
