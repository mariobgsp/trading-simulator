import { useEffect, useRef, useState } from 'react';
import { createChart, LineStyle } from 'lightweight-charts';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { fetchOHLCV } from './prices';
import { fetchBrokerFlowDaily } from './stockbit';
import { calculateRSI, calculateStochastic, calculateMFI, calculateCFI, alignData } from './indicators';
import type { OHLCV, Point } from './indicators';

interface Props {
  emiten: string;
}

export default function AdvancedChartCard({ emiten }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndicators, setActiveIndicators] = useState({
    rsi: true,
    stoch: false,
    mfi: false,
    bandar: true,
  });

  // Series refs
  const seriesRefs = useRef({
    candle: null as ISeriesApi<"Candlestick"> | null,
    volume: null as ISeriesApi<"Histogram"> | null,
    bandar: null as ISeriesApi<"Line"> | null,
    rsi: null as ISeriesApi<"Line"> | null,
    stoch: null as ISeriesApi<"Line"> | null,
    mfi: null as ISeriesApi<"Line"> | null,
  });

  useEffect(() => {
    if (!emiten || !chartContainerRef.current) return;
    
    // Initialize chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#8492a6',
      },
      grid: {
        vertLines: { color: 'rgba(70, 90, 140, 0.1)' },
        horzLines: { color: 'rgba(70, 90, 140, 0.1)' },
      },
      timeScale: {
        timeVisible: true,
        borderColor: 'rgba(70, 90, 140, 0.2)',
      },
      rightPriceScale: {
        borderColor: 'rgba(70, 90, 140, 0.2)',
        scaleMargins: { top: 0, bottom: 0.3 }, // Leave room at bottom for indicators
      },
      autoSize: true,
    });
    chartRef.current = chart;

    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch 6 months of OHLCV
        const ohlcv = await fetchOHLCV(emiten, '6mo') as OHLCV[];
        if (ohlcv.length === 0) throw new Error('No price data found');

        // Fetch bandar flow (optional, might fail if not IDX)
        let bandarCFI: Point[] = [];
        try {
          const flow = await fetchBrokerFlowDaily(emiten, 100); // 100 days
          if (flow?.data?.activities) {
            // Find "Bandar" or "Whale"
            const bandarActivity = flow.data.activities.find((a: any) => 
              a.broker_status === 'Bandar' || a.broker_status === 'Smart Money'
            );
            
            if (bandarActivity && bandarActivity.daily_data && flow.data.trading_dates) {
              const dates = flow.data.trading_dates.slice().reverse(); // Oldest first
              const dateMap = new Map(bandarActivity.daily_data.map((d: any) => [d.d, d.n]));
              
              const flowsArray = dates.map((d: string) => Number(dateMap.get(d) || 0));
              const cfi = calculateCFI(dates, flowsArray);
              
              // Align with OHLCV dates
              bandarCFI = alignData(ohlcv, cfi);
            }
          }
        } catch (e) { console.warn('Failed to fetch bandar flow', e); }

        if (!isMounted) return;

        // Calculate Indicators
        const rsiData = calculateRSI(ohlcv, 14);
        const stochData = calculateStochastic(ohlcv, 14);
        const mfiData = calculateMFI(ohlcv, 14);

        // Render main Candlestick Series
        const candleSeries = chart.addCandlestickSeries({
          upColor: '#34d399',
          downColor: '#f87171',
          borderVisible: false,
          wickUpColor: '#34d399',
          wickDownColor: '#f87171',
        });
        candleSeries.setData(ohlcv.map(d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close })));
        seriesRefs.current.candle = candleSeries;

        // Render Volume (overlay on main chart at the bottom)
        const volumeSeries = chart.addHistogramSeries({
          color: 'rgba(96, 165, 250, 0.3)',
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        });
        chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.7, bottom: 0 } });
        volumeSeries.setData(ohlcv.map(d => ({
          time: d.time,
          value: d.value,
          color: d.close >= d.open ? 'rgba(52, 211, 153, 0.3)' : 'rgba(248, 113, 113, 0.3)',
        })));
        seriesRefs.current.volume = volumeSeries;

        // Render Bandar CFI Line (Overlay on main chart, left scale)
        if (bandarCFI.length > 0) {
          const bandarSeries = chart.addLineSeries({
            color: '#fbbf24',
            lineWidth: 2,
            priceScaleId: 'left',
          });
          chart.priceScale('left').applyOptions({ scaleMargins: { top: 0, bottom: 0.3 } });
          bandarSeries.setData(bandarCFI);
          seriesRefs.current.bandar = bandarSeries;
        }

        // Render RSI (Separate bottom scale)
        const rsiSeries = chart.addLineSeries({
          color: '#22d3ee',
          lineWidth: 2,
          priceScaleId: 'rsi',
        });
        chart.priceScale('rsi').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
        rsiSeries.setData(rsiData);
        // Add RSI bands (30/70) using horizontal lines
        rsiSeries.createPriceLine({ price: 70, color: 'rgba(248,113,113,0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
        rsiSeries.createPriceLine({ price: 30, color: 'rgba(52,211,153,0.5)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
        seriesRefs.current.rsi = rsiSeries;

        // Render Stochastic (Separate bottom scale)
        const stochSeries = chart.addLineSeries({
          color: '#818cf8',
          lineWidth: 2,
          priceScaleId: 'stoch', 
        });
        chart.priceScale('stoch').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
        stochSeries.setData(stochData);
        seriesRefs.current.stoch = stochSeries;

        // Render MFI (Separate bottom scale)
        const mfiSeries = chart.addLineSeries({
          color: '#34d399',
          lineWidth: 2,
          priceScaleId: 'mfi',
        });
        chart.priceScale('mfi').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
        mfiSeries.setData(mfiData);
        seriesRefs.current.mfi = mfiSeries;

        chart.timeScale().fitContent();

      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : 'Failed to load chart data');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
      chart.remove();
      chartRef.current = null;
    };
  }, [emiten]);

  // Toggle indicator visibility
  useEffect(() => {
    const refs = seriesRefs.current;
    if (refs.rsi) refs.rsi.applyOptions({ visible: activeIndicators.rsi });
    if (refs.stoch) refs.stoch.applyOptions({ visible: activeIndicators.stoch });
    if (refs.mfi) refs.mfi.applyOptions({ visible: activeIndicators.mfi });
    if (refs.bandar) refs.bandar.applyOptions({ visible: activeIndicators.bandar });
  }, [activeIndicators]);

  const toggle = (key: keyof typeof activeIndicators) => {
    setActiveIndicators(p => ({ ...p, [key]: !p[key] }));
  };

  return (
    <div className="card fade-in" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '600px' }}>
      <div className="card-header" style={{ padding: '16px 18px 0', marginBottom: 0 }}>
        <div className="card-title" style={{ margin: 0 }}>📈 Advanced Chart — {emiten}</div>
        <div className="date-range-btns">
          <button className={`date-range-btn ${activeIndicators.bandar ? 'active' : ''}`} onClick={() => toggle('bandar')} style={{ color: '#fbbf24' }}>Bandar CFI</button>
          <button className={`date-range-btn ${activeIndicators.rsi ? 'active' : ''}`} onClick={() => toggle('rsi')} style={{ color: '#22d3ee' }}>RSI</button>
          <button className={`date-range-btn ${activeIndicators.stoch ? 'active' : ''}`} onClick={() => toggle('stoch')} style={{ color: '#818cf8' }}>Stoch</button>
          <button className={`date-range-btn ${activeIndicators.mfi ? 'active' : ''}`} onClick={() => toggle('mfi')} style={{ color: '#34d399' }}>MFI</button>
        </div>
      </div>
      
      {loading && <div className="spinner" style={{ margin: 'auto' }} />}
      {error && !loading && <div className="empty">{error}</div>}
      
      <div 
        ref={chartContainerRef} 
        style={{ flex: 1, width: '100%', visibility: loading || error ? 'hidden' : 'visible' }} 
      />
    </div>
  );
}
