import { useState, useEffect } from 'react';
import { fetchOHLCV } from './prices';
import { fetchHistoricalSummary } from './stockbit';
import { calculateRSI, calculateMACD, calculateStochasticFull } from './indicators';
import type { OHLCV } from './indicators';

interface Signal {
  indicator: string;
  status: 'Bullish' | 'Bearish' | 'Neutral';
  detail: string;
  isGoldenCross?: boolean;
}

export default function IndicatorSignalCard({ emiten }: { emiten: string }) {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 180);
        const fmt = (d: Date) => d.toISOString().split('T')[0];
        
        let data: OHLCV[] = [];
        try {
          const stockbitData = await fetchHistoricalSummary(emiten, fmt(start), fmt(end), 150);
          
          if (stockbitData && stockbitData.length >= 30) {
            data = stockbitData.map(r => ({
              time: r.date?.split('T')[0] || '',
              open: r.open,
              high: r.high,
              low: r.low,
              close: r.close,
              value: r.volume
            })).filter(d => d.time).sort((a, b) => a.time.localeCompare(b.time));
          }
        } catch (e) {
          console.warn("Stockbit fetch failed or insufficient, trying Yahoo data instead", e);
        }

        if (data.length < 30) {
          data = await fetchOHLCV(emiten, '6mo');
        }

        if (data.length < 30) {
          setSignals([]);
          return;
        }

        const rsiData = calculateRSI(data, 14);
        const macdData = calculateMACD(data);
        const stochData = calculateStochasticFull(data, 14, 3, 3);

        const newSignals: Signal[] = [];

        // --- MACD ---
        if (macdData.length >= 2) {
          const current = macdData[macdData.length - 1];
          const prev = macdData[macdData.length - 2];
          const isGoldenCross = prev.macd <= prev.signal && current.macd > current.signal;
          const isDeathCross = prev.macd >= prev.signal && current.macd < current.signal;
          
          let status: Signal['status'] = 'Neutral';
          if (current.macd > current.signal) status = 'Bullish';
          if (current.macd < current.signal) status = 'Bearish';

          let detail = `MACD: ${current.macd.toFixed(2)} | Signal: ${current.signal.toFixed(2)}`;
          if (isGoldenCross) detail = '🚨 GOLDEN CROSS: MACD crossed above Signal!';
          if (isDeathCross) detail = '⚠️ DEATH CROSS: MACD crossed below Signal!';

          newSignals.push({
            indicator: 'MACD',
            status,
            detail,
            isGoldenCross
          });
        }

        // --- RSI ---
        if (rsiData.length >= 2) {
          const currentRSI = rsiData[rsiData.length - 1].value;
          const prevRSI = rsiData[rsiData.length - 2].value;
          
          let status: Signal['status'] = 'Neutral';
          if (currentRSI > 50) status = 'Bullish';
          if (currentRSI < 50) status = 'Bearish';

          // RSI "Golden Cross" typically crossing 50 or moving out of oversold (30)
          const isGoldenCross = (prevRSI <= 30 && currentRSI > 30) || (prevRSI <= 50 && currentRSI > 50);

          let detail = `Current RSI: ${currentRSI.toFixed(1)}`;
          if (currentRSI >= 70) detail += ' (Overbought)';
          if (currentRSI <= 30) detail += ' (Oversold)';
          if (isGoldenCross) detail = '🚨 BULLISH CROSS: RSI moving upwards!';

          newSignals.push({
            indicator: 'RSI (14)',
            status,
            detail,
            isGoldenCross
          });
        }

        // --- Stochastic ---
        if (stochData.length >= 2) {
          const current = stochData[stochData.length - 1];
          const prev = stochData[stochData.length - 2];
          
          let status: Signal['status'] = 'Neutral';
          if (current.k > current.d) status = 'Bullish';
          if (current.k < current.d) status = 'Bearish';

          const isGoldenCross = prev.k <= prev.d && current.k > current.d && current.k < 80;
          const isDeathCross = prev.k >= prev.d && current.k < current.d && current.k > 20;

          let detail = `%K: ${current.k.toFixed(1)} | %D: ${current.d.toFixed(1)}`;
          if (isGoldenCross) detail = '🚨 GOLDEN CROSS: %K crossed above %D!';
          if (isDeathCross) detail = '⚠️ DEATH CROSS: %K crossed below %D!';

          newSignals.push({
            indicator: 'Stochastic (14,3,3)',
            status,
            detail,
            isGoldenCross
          });
        }

        setSignals(newSignals);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [emiten]);

  return (
    <div className="card fade-in">
      <div className="card-title">🎯 Technical Indicators Signal</div>
      {loading ? (
        <div style={{ color: 'var(--text3)' }}>Analyzing {emiten}...</div>
      ) : signals.length === 0 ? (
        <div style={{ color: 'var(--text3)' }}>Not enough data for {emiten}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {signals.map((s, i) => (
            <div key={i} style={{
              padding: '12px',
              borderRadius: '8px',
              background: s.isGoldenCross ? 'rgba(39, 174, 96, 0.15)' : 'var(--bg-layer1)',
              border: s.isGoldenCross ? '1px solid var(--green)' : '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '4px' }}>
                  {s.indicator}
                </div>
                <div style={{ fontSize: '0.8rem', color: s.isGoldenCross ? 'var(--green)' : 'var(--text2)' }}>
                  {s.detail}
                </div>
              </div>
              <div style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                background: s.status === 'Bullish' ? 'rgba(39, 174, 96, 0.2)' : s.status === 'Bearish' ? 'rgba(231, 76, 60, 0.2)' : 'rgba(149, 165, 166, 0.2)',
                color: s.status === 'Bullish' ? 'var(--green)' : s.status === 'Bearish' ? 'var(--red)' : 'var(--text2)'
              }}>
                {s.status}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
