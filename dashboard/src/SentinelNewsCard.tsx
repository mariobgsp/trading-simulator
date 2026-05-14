import { useState, useEffect } from 'react';

interface SentinelNewsItem {
  id: number;
  title: string;
  link: string;
  timestamp: string;
  source: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  sentiment_score: number;
  summary: string[];
}

export default function SentinelNewsCard() {
  const [news, setNews] = useState<SentinelNewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch('/api/files/news_data.json');
        if (!response.ok) throw new Error('Failed to load news');
        const data = await response.json();
        // Only show analyzed items and ensure they have required fields
        const filtered = data.filter((item: any) => item.status === 'analyzed');
        setNews(filtered);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
    const interval = setInterval(fetchNews, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const getSentimentColor = (sentiment: string) => {
    if (sentiment === 'Bullish') return '#00ff88';
    if (sentiment === 'Bearish') return '#ff4444';
    return '#888888';
  };

  return (
    <div className="card sentinel-news fade-in" id="sentinel-card">
      <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
        <div className="card-title">📡 SENTINEL NEWS WIRE</div>
        <div className="badge badge-green">LIVE</div>
      </div>

      <div className="news-scroll-container" style={{ maxHeight: '600px', overflowY: 'auto', padding: '10px' }}>
        {loading && <div className="spinner" style={{ margin: '20px auto', display: 'block' }} />}
        {news.length === 0 && !loading && <div className="empty">No analyzed signals available</div>}
        
        {news.map((item, idx) => (
          <div key={item.id || idx} className="sentinel-item" style={{ 
            padding: '12px 0', 
            borderBottom: '1px solid #333',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.65rem', color: '#888', fontWeight: 'bold' }}>{String(item.source || 'Unknown').toUpperCase()}</span>
              <span style={{ 
                fontSize: '0.65rem', 
                padding: '2px 6px', 
                borderRadius: '4px', 
                backgroundColor: getSentimentColor(item.sentiment) + '22',
                color: getSentimentColor(item.sentiment),
                border: `1px solid ${getSentimentColor(item.sentiment)}44`
              }}>
                {item.sentiment || 'Neutral'} ({item.sentiment_score?.toFixed(1) || '0.0'})
              </span>
            </div>
            
            <a href={item.link} target="_blank" rel="noreferrer" style={{ 
              fontSize: '0.9rem', 
              fontWeight: 600, 
              color: 'var(--text1)',
              textDecoration: 'none'
            }}>
              {item.title}
            </a>

            {item.summary && (
              <div className="ai-summary" style={{ 
                backgroundColor: '#1a1a1a', 
                padding: '8px', 
                borderRadius: '4px',
                fontSize: '0.75rem',
                color: '#bbb',
                borderLeft: '2px solid var(--accent)'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '0.6rem', color: 'var(--accent)' }}>AI INSIGHT</div>
                <ul style={{ margin: 0, paddingLeft: '15px' }}>
                  {item.summary.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            
            <div style={{ fontSize: '0.6rem', color: '#666' }}>{item.timestamp}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
