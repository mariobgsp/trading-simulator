import { useState, useEffect } from 'react';
import { fetchEmitenInfo } from './stockbit';

interface Props { emiten: string }

export default function EmitenInfoCard({ emiten }: Props) {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!emiten) return;
    setLoading(true);
    fetchEmitenInfo(emiten)
      .then(d => setInfo(d?.data || null))
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, [emiten]);

  if (loading) return <div className="card fade-in"><div className="spinner" style={{ margin: '12px auto', display: 'block' }} /></div>;
  if (!info) return null;

  const pct = info.percentage ?? 0;
  const isPos = pct >= 0;

  return (
    <div className="card fade-in" id="emiten-info-card">
      <div className="emiten-header">
        <div>
          <div className="emiten-name">{info.symbol || emiten}</div>
          <div style={{ fontSize: '.82rem', color: 'var(--text2)', fontWeight: 500 }}>{info.name}</div>
          <div className="emiten-sector">{info.sector}{info.sub_sector ? ` · ${info.sub_sector}` : ''}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="emiten-price">{Number(info.price || 0).toLocaleString()}</div>
          <div className={`emiten-change ${isPos ? 'pnl-pos' : 'pnl-neg'}`}>
            {isPos ? '+' : ''}{info.change || 0} ({isPos ? '+' : ''}{pct.toFixed(2)}%)
          </div>
        </div>
      </div>
    </div>
  );
}
