import { useState, useEffect } from 'react';
import { fetchStockbitNews, fetchIdxNews, fetchAnnouncements, fetchOfficialNews } from './stockbit';

interface Props { emiten?: string }

type NewsTab = 'portal' | 'social' | 'idx';
type Region = 'ID' | 'Global' | 'All';

export default function NewsCard({ emiten }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<NewsTab>('portal');
  const [region, setRegion] = useState<Region>('ID');

  useEffect(() => {
    setLoading(true);
    const doFetch = async () => {
      try {
        let data: any[] = [];
        if (activeTab === 'portal') {
          const res = await fetch('/api/files/news_data.json');
          if (res.ok) {
            data = await res.json();
            // Filter by region if not 'All'
            if (region !== 'All') {
              data = data.filter((item: any) => (item.region === region) || (!item.region && region === 'Global'));
            }
            // Filter by emiten if provided
            if (emiten) {
              const upperEmiten = emiten.toUpperCase();
              data = data.filter((item: any) => 
                item.title?.toUpperCase().includes(upperEmiten) || 
                item.description?.toUpperCase().includes(upperEmiten) ||
                item.tickers?.includes(upperEmiten)
              );
            }
          }
        } else if (activeTab === 'social') {
          data = await fetchStockbitNews(emiten || 'IDX');
        } else if (activeTab === 'idx') {
          const res = await fetch('/api/files/news_data.json');
          if (res.ok) {
            data = await res.json();
            data = data.filter((item: any) => item.source === 'IDX Official');
          }
        }
        setItems(data);
      } catch (err) {
        console.error('Fetch error:', err);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    doFetch();
  }, [emiten, activeTab, region]);

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
    return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
  };

  const getSourceIcon = (source: string) => {
    const s = source?.toLowerCase() || '';
    if (s.includes('cnbc')) return '🔴';
    if (s.includes('detik')) return '🔵';
    if (s.includes('kompas')) return '🟠';
    if (s.includes('investing')) return '💹';
    if (s.includes('yahoo')) return '🟣';
    if (s.includes('idx')) return '🏛️';
    return '📰';
  };

  return (
    <div className="card fade-in" id="news-card">
      <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <div className="card-title" style={{ margin: 0 }}>
            ⚡ {emiten ? `${emiten} Intelligence` : 'Market Intelligence'}
          </div>
          {loading && <div className="spinner-sm" />}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <div className="date-range-btns" style={{ justifyContent: 'flex-start' }}>
            <button className={`date-range-btn ${activeTab === 'portal' ? 'active' : ''}`} onClick={() => setActiveTab('portal')}>Portals</button>
            <button className={`date-range-btn ${activeTab === 'idx' ? 'active' : ''}`} onClick={() => setActiveTab('idx')}>IDX Official</button>
            <button className={`date-range-btn ${activeTab === 'social' ? 'active' : ''}`} onClick={() => setActiveTab('social')}>Social</button>
          </div>

          {activeTab === 'portal' && (
            <div className="date-range-btns" style={{ gap: '4px' }}>
              <button style={{ padding: '2px 8px', fontSize: '0.65rem' }} className={`date-range-btn ${region === 'ID' ? 'active' : ''}`} onClick={() => setRegion('ID')}>ID</button>
              <button style={{ padding: '2px 8px', fontSize: '0.65rem' }} className={`date-range-btn ${region === 'Global' ? 'active' : ''}`} onClick={() => setRegion('Global')}>Global</button>
              <button style={{ padding: '2px 8px', fontSize: '0.65rem' }} className={`date-range-btn ${region === 'All' ? 'active' : ''}`} onClick={() => setRegion('All')}>All</button>
            </div>
          )}
        </div>
      </div>

      <div className="news-content-container" style={{ maxHeight: '550px', overflowY: 'auto' }}>
        {!loading && items.length === 0 && (
          <div className="empty" style={{ padding: '40px 20px' }}>
            <div>No matching news found</div>
            {emiten && <div style={{ fontSize: '0.7rem', marginTop: '8px', color: '#666' }}>Try switching to "Global" or "All" portals</div>}
          </div>
        )}

        {!loading && items.map((item, i) => {
          const title = item.title || item.body?.split('\n')[0] || item.content?.split('\n')[0] || 'Untitled';
          const body = item.description || item.body || item.content || '';
          const time = item.timestamp || item.created_at || item.published_at || '';
          const source = item.source || '';
          const url = item.link || item.url || '';
          const tickers = item.tickers || [];

          return (
            <div className="news-item" key={i} style={{ padding: '16px', borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ fontSize: '0.6rem', background: '#333', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    {source.toUpperCase()}
                  </span>
                  {item.region && (
                    <span style={{ fontSize: '0.6rem', background: item.region === 'ID' ? '#0066cc22' : '#cc660022', color: item.region === 'ID' ? '#0088ff' : '#ff8800', padding: '2px 6px', borderRadius: '4px' }}>
                      {item.region}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {tickers.slice(0, 3).map((t: string) => (
                    <span key={t} style={{ fontSize: '0.6rem', color: 'var(--accent)', fontWeight: 'bold' }}>${t}</span>
                  ))}
                </div>
              </div>
              
              <div className="news-title" style={{ fontSize: '0.92rem', lineHeight: '1.4', marginBottom: '8px', fontWeight: 500 }}>
                {url ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'var(--text1)' }}>{stripHtml(title)}</a> : stripHtml(title)}
              </div>
              
              <div className="news-meta" style={{ display: 'flex', gap: '12px', fontSize: '0.7rem', color: '#777' }}>
                <span>{getSourceIcon(source)} {source}</span>
                {time && <span>• {formatTime(time)}</span>}
              </div>

              {body && title !== body && (
                <div className="news-snippet" style={{ marginTop: '8px', fontSize: '0.75rem', color: '#999', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {stripHtml(body)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
