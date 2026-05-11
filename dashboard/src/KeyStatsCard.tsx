import { useState, useEffect } from 'react';
import { fetchKeyStats } from './stockbit';

interface Props { emiten: string }

function formatLabel(name: string): string {
  return name.replace('Current ', '').replace(' (TTM)', '').replace(' (Quarter)', '').replace(' (Quarter YoY Growth)', ' YoY').replace('Price to ', 'P/').replace('Ratio', '');
}

export default function KeyStatsCard({ emiten }: Props) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!emiten) return;
    setLoading(true);
    fetchKeyStats(emiten)
      .then(d => setStats(d))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [emiten]);

  if (loading) return <div className="card fade-in"><div className="card-title">Key Stats</div><div className="spinner" style={{ margin: '16px auto', display: 'block' }} /></div>;
  if (!stats) return null;

  const sections: [string, any[], number][] = [
    ['Current Valuation', stats.currentValuation, 6],
    ['Income Statement', stats.incomeStatement, 4],
    ['Balance Sheet', stats.balanceSheet, 5],
    ['Profitability', stats.profitability, 3],
    ['Growth', stats.growth, 3],
  ];

  return (
    <div className="card fade-in" id="keystats-card">
      <div className="card-header">
        <div className="card-title" style={{ margin: 0 }}>📈 Key Stats — {emiten}</div>
      </div>
      {sections.map(([title, items, max]) => {
        if (!items?.length) return null;
        return (
          <div className="keystats-section" key={title}>
            <div className="keystats-section-title">{title}</div>
            <table className="keystats-table">
              <tbody>
                {items.slice(0, max).map((item: any) => (
                  <tr key={item.id}>
                    <td className="keystats-label">{formatLabel(item.name)}</td>
                    <td className="keystats-value">{item.value || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
