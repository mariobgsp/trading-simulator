import { useState, useEffect } from 'react';
import { fetchOrderbook } from './stockbit';

interface Props { emiten: string }

export default function OrderbookCard({ emiten }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!emiten) return;
    setLoading(true);
    fetchOrderbook(emiten)
      .then(d => setData(d?.data || null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [emiten]);

  if (loading) return <div className="card fade-in"><div className="card-title">Orderbook</div><div className="spinner" style={{ margin: '16px auto', display: 'block' }} /></div>;
  if (!data) return null;

  const bids = (data.bid || []).slice(0, 5);
  const offers = (data.offer || []).slice(0, 5);
  const totalBid = data.total_bid_offer?.bid?.lot ? parseFloat(String(data.total_bid_offer.bid.lot).replace(/,/g, '')) : 0;
  const totalOffer = data.total_bid_offer?.offer?.lot ? parseFloat(String(data.total_bid_offer.offer.lot).replace(/,/g, '')) : 0;
  const maxVol = Math.max(...[...bids, ...offers].map((r: any) => parseFloat(String(r.volume || '0').replace(/,/g, ''))), 1);
  const bidRatio = totalBid + totalOffer > 0 ? (totalBid / (totalBid + totalOffer) * 100) : 50;

  return (
    <div className="card fade-in" id="orderbook-card">
      <div className="card-header">
        <div className="card-title" style={{ margin: 0 }}>📊 Orderbook — {emiten}</div>
        <div style={{ fontSize: '.65rem', color: 'var(--text3)' }}>
          ARA: {data.ara?.value || '-'} · ARB: {data.arb?.value || '-'}
        </div>
      </div>

      {/* Offers (asks) - reversed so lowest is at bottom */}
      <div style={{ marginBottom: 2 }}>
        <div style={{ fontSize: '.62rem', color: 'var(--text3)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Offer (Ask)</div>
        {[...offers].reverse().map((o: any, i: number) => {
          const vol = parseFloat(String(o.volume || '0').replace(/,/g, ''));
          const w = Math.max(4, (vol / maxVol) * 100);
          return (
            <div className="orderbook-row" key={`o${i}`}>
              <div className="orderbook-price" style={{ color: 'var(--red)' }}>{Number(o.price).toLocaleString()}</div>
              <div style={{ flex: 1, position: 'relative', height: 18 }}>
                <div className="orderbook-bar ask" style={{ width: `${w}%`, position: 'absolute', right: 0 }} />
              </div>
              <div className="orderbook-vol">{Number(vol).toLocaleString()}</div>
            </div>
          );
        })}
      </div>

      {/* Spread */}
      <div className="orderbook-spread">
        High: {data.high?.toLocaleString() || '-'} · Close: {data.close?.toLocaleString() || '-'}
      </div>

      {/* Bids */}
      <div style={{ marginTop: 2 }}>
        <div style={{ fontSize: '.62rem', color: 'var(--text3)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Bid</div>
        {bids.map((b: any, i: number) => {
          const vol = parseFloat(String(b.volume || '0').replace(/,/g, ''));
          const w = Math.max(4, (vol / maxVol) * 100);
          return (
            <div className="orderbook-row" key={`b${i}`}>
              <div className="orderbook-price" style={{ color: 'var(--green)' }}>{Number(b.price).toLocaleString()}</div>
              <div style={{ flex: 1, position: 'relative', height: 18 }}>
                <div className="orderbook-bar bid" style={{ width: `${w}%` }} />
              </div>
              <div className="orderbook-vol">{Number(vol).toLocaleString()}</div>
            </div>
          );
        })}
      </div>

      {/* Bid/Offer ratio bar */}
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.65rem', color: 'var(--text3)', marginBottom: 3 }}>
          <span>Bid: {totalBid.toLocaleString()}</span>
          <span>Offer: {totalOffer.toLocaleString()}</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(248,113,113,.15)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${bidRatio}%`, background: 'rgba(52,211,153,.4)', borderRadius: 3, transition: 'width .3s' }} />
        </div>
        <div style={{ textAlign: 'center', fontSize: '.62rem', color: 'var(--text3)', marginTop: 2 }}>
          Ratio: {bidRatio.toFixed(1)}% Bid
        </div>
      </div>
    </div>
  );
}
