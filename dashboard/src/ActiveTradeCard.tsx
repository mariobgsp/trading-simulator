import { useState, useEffect } from 'react';
import { fetchActiveTrade } from './stockbit';

interface Props { emiten: string }

export default function ActiveTradeCard({ emiten }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!emiten) return;
    setLoading(true);
    fetchActiveTrade(emiten, 15)
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [emiten]);

  if (loading) return <div className="card fade-in"><div className="card-title">Active Trade</div><div className="spinner" style={{ margin: '16px auto', display: 'block' }} /></div>;
  if (!rows.length) return <div className="card fade-in"><div className="card-title">Active Trade</div><div className="empty">No trading data</div></div>;

  const maxVol = Math.max(...rows.map(r => r.volume || 0), 1);
  const fmt = (n: number) => {
    if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
    return n.toLocaleString();
  };

  return (
    <div className="card fade-in" id="active-trade-card">
      <div className="card-title">⚡ Active Trade — {emiten}</div>
      <div className="table-wrap">
        <table className="active-trade-table">
          <thead>
            <tr>
              <th>Date</th><th>Close</th><th>Chg%</th><th>Volume</th><th></th>
              <th>Value</th><th>Freq</th><th>Net Foreign</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const chg = r.change_percentage || 0;
              const nf = r.net_foreign || 0;
              const volW = Math.max(4, (r.volume / maxVol) * 100);
              return (
                <tr key={i}>
                  <td className="mono">{r.date?.split('T')[0] || '-'}</td>
                  <td className="mono">{r.close?.toLocaleString() || '-'}</td>
                  <td className={`mono ${chg >= 0 ? 'pnl-pos' : 'pnl-neg'}`}>{chg >= 0 ? '+' : ''}{chg.toFixed(2)}%</td>
                  <td className="mono">{fmt(r.volume || 0)}</td>
                  <td style={{ width: 80 }}>
                    <div className="vol-bar" style={{ width: `${volW}%`, background: chg >= 0 ? 'rgba(52,211,153,.25)' : 'rgba(248,113,113,.25)' }} />
                  </td>
                  <td className="mono">{fmt(r.value || 0)}</td>
                  <td className="mono">{r.frequency?.toLocaleString() || '-'}</td>
                  <td className={`mono ${nf >= 0 ? 'foreign-pos' : 'foreign-neg'}`}>
                    {nf >= 0 ? '+' : ''}{fmt(nf)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
