import { useState, useEffect } from 'react';
import { fetchMarketDetector, getBrokerSummary } from './stockbit';

interface Props { emiten: string }

const FMT_NUM = (n: number | string | undefined) => {
  if (n == null) return '-';
  const v = typeof n === 'string' ? parseFloat(n) : n;
  return isNaN(v) ? '-' : v.toLocaleString();
};
const FMT_B = (n: number) => (!n ? '-' : (n / 1e9).toFixed(1));
const FMT_COMPACT = (s: string) => {
  const n = parseFloat(s); if (isNaN(n)) return '-';
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
};
const ACC_CLS = (s: string) => {
  if (!s) return 'badge-neutral';
  const l = s.toLowerCase();
  if (l.includes('acc') && !l.includes('small')) return 'badge-acc';
  if (l.includes('small dist')) return 'badge-small-dist';
  if (l.includes('dist')) return 'badge-dist';
  return 'badge-neutral';
};

type RangeKey = '1w' | '2w' | '1m' | '3m';
const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: '1w', label: '1W', days: 7 },
  { key: '2w', label: '2W', days: 14 },
  { key: '1m', label: '1M', days: 30 },
  { key: '3m', label: '3M', days: 90 },
];

export default function BandarmologyCard({ emiten }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<RangeKey>('2w');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!emiten) return;
    setLoading(true); setError('');
    const r = RANGES.find(x => x.key === range)!;
    const to = new Date();
    const from = new Date(); from.setDate(from.getDate() - r.days);
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    fetchMarketDetector(emiten, fmt(from), fmt(to))
      .then(d => {
        const summary = getBrokerSummary(d);
        setData(summary);
      })
      .catch(e => setError(e.message || 'Failed'))
      .finally(() => setLoading(false));
  }, [emiten, range]);

  if (loading) return <div className="card fade-in broker-card"><div className="card-title">Bandarmology</div><div className="spinner" style={{ margin: '16px auto', display: 'block' }} /></div>;
  if (error) return <div className="card fade-in broker-card"><div className="card-title">Bandarmology</div><div className="empty">{error}</div></div>;
  if (!data) return null;

  const { detector, topBuyers, topSellers } = data;

  return (
    <div className="card fade-in broker-card" id="bandarmology-card">
      <div className="card-header">
        <div className="card-title" style={{ margin: 0 }}>🔍 Bandarmology — {emiten}</div>
        <div className="date-range-btns">
          {RANGES.map(r => (
            <button key={r.key} className={`date-range-btn ${range === r.key ? 'active' : ''}`} onClick={() => setRange(r.key)}>{r.label}</button>
          ))}
        </div>
      </div>

      {/* Bandar Detector */}
      <div className="section-title">Bandar Detector</div>
      <table className="broker-table">
        <thead><tr><th></th><th>Volume</th><th>%</th><th>Rp(B)</th><th>Acc/Dist</th></tr></thead>
        <tbody>
          {['top1', 'top3', 'top5', 'avg'].map(k => {
            const d = detector[k];
            const label = k === 'avg' ? 'Average' : k.replace('top', 'Top ');
            return (
              <tr key={k}>
                <td className="row-label">{label}</td>
                <td className="num">{FMT_NUM(d?.vol)}</td>
                <td className="num">{d?.percent?.toFixed(1)}</td>
                <td className="num">{FMT_B(d?.amount)}</td>
                <td><span className={`badge ${ACC_CLS(d?.accdist)}`}>{d?.accdist || '-'}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Broker Stats */}
      <div className="section-title">Broker Statistics</div>
      <table className="broker-table">
        <thead><tr><th></th><th>Buyer</th><th>Seller</th><th>#</th><th>Acc/Dist</th></tr></thead>
        <tbody>
          <tr>
            <td className="row-label">Broker</td>
            <td className="num">{detector.total_buyer}</td>
            <td className="num">{detector.total_seller}</td>
            <td className="num">{detector.number_broker_buysell}</td>
            <td><span className={`badge ${ACC_CLS(detector.broker_accdist)}`}>{detector.broker_accdist}</span></td>
          </tr>
          <tr><td className="row-label">Net Volume</td><td colSpan={3} className="num-wide">{FMT_NUM(detector.volume)}</td><td></td></tr>
          <tr><td className="row-label">Net Value</td><td colSpan={3} className="num-wide">{FMT_B(detector.value)}B</td><td></td></tr>
          <tr><td className="row-label">Average (Rp)</td><td colSpan={3} className="num-wide">{Math.round(detector.average)}</td><td></td></tr>
        </tbody>
      </table>

      {/* Top Buyers & Sellers */}
      <div className="section-title">Top Brokers</div>
      <table className="broker-table">
        <thead><tr><th>BY</th><th>B.val</th><th>B.lot</th><th>B.avg</th><th>SL</th><th>S.val</th><th>S.lot</th><th>S.avg</th></tr></thead>
        <tbody>
          {[0, 1, 2, 3].map(i => {
            const b = topBuyers[i], s = topSellers[i];
            return (
              <tr key={i}>
                <td className="broker-code buyer">{b?.netbs_broker_code || '-'}</td>
                <td className="num">{b ? FMT_COMPACT(b.bval) : '-'}</td>
                <td className="num">{b ? FMT_COMPACT(b.blot) : '-'}</td>
                <td className="num">{b ? Math.round(parseFloat(b.netbs_buy_avg_price)) : '-'}</td>
                <td className="broker-code seller">{s?.netbs_broker_code || '-'}</td>
                <td className="num">{s ? FMT_COMPACT((s.sval || '').replace('-', '')) : '-'}</td>
                <td className="num">{s ? FMT_COMPACT((s.slot || '').replace('-', '')) : '-'}</td>
                <td className="num">{s ? Math.round(parseFloat(s.netbs_sell_avg_price)) : '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
