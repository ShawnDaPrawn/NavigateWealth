import React, { useEffect, useRef, memo, useState } from 'react';

function TradingViewMarketOverviewWidget() {
  const container = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState(false);

  // Create TradingView script when dimensions change
  useEffect(() => {
    const el = container.current;
    // Clean up previous script if any
    if (el) {
      el.innerHTML = '';
      
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js";
      script.type = "text/javascript";
      script.async = true;

      // Graceful fallback if external script fails to load
      script.onerror = () => {
        console.debug('[TradingView] Market overview widget script failed to load.');
        setHasError(true);
      };
      
      // Calculate responsive dimensions
      const width = window.innerWidth;
      let dimensions = { width: "100%", height: "600" };
      
      if (width >= 1536) { // 2xl
        dimensions = { width: "100%", height: "800" };
      } else if (width >= 1280) { // xl
        dimensions = { width: "100%", height: "700" };
      } else if (width >= 1024) { // lg
        dimensions = { width: "100%", height: "650" };
      } else if (width >= 768) { // md
        dimensions = { width: "100%", height: "600" };
      } else { // sm and smaller
        dimensions = { width: "100%", height: "500" };
      }

      script.innerHTML = JSON.stringify({
        "colorTheme": "light",
        "dateRange": "12M",
        "showChart": true,
        "locale": "en",
        "largeChartUrl": "",
        "isTransparent": false,
        "showSymbolLogo": true,
        "showFloatingTooltip": false,
        "width": dimensions.width,
        "height": dimensions.height,
        "plotLineColorGrowing": "rgba(41, 98, 255, 1)",
        "plotLineColorFalling": "rgba(41, 98, 255, 1)",
        "gridLineColor": "rgba(240, 243, 250, 0)",
        "scaleFontColor": "rgba(106, 109, 120, 1)",
        "belowLineFillColorGrowing": "rgba(41, 98, 255, 0.12)",
        "belowLineFillColorFalling": "rgba(41, 98, 255, 0.12)",
        "belowLineFillColorGrowingBottom": "rgba(41, 98, 255, 0)",
        "belowLineFillColorFallingBottom": "rgba(41, 98, 255, 0)",
        "symbolActiveColor": "rgba(41, 98, 255, 0.12)",
        "tabs": [
          {
            "title": "Indices",
            "symbols": [
              { "s": "FOREXCOM:SPXUSD", "d": "S&P 500" },
              { "s": "FOREXCOM:NSXUSD", "d": "US 100" },
              { "s": "FOREXCOM:DJI", "d": "Dow 30" },
              { "s": "INDEX:NKY", "d": "Nikkei 225" },
              { "s": "INDEX:DEU40", "d": "DAX Index" },
              { "s": "FOREXCOM:UKXGBP", "d": "FTSE 100" }
            ],
            "originalTitle": "Indices"
          },
          {
            "title": "Futures",
            "symbols": [
              { "s": "CME_MINI:ES1!", "d": "S&P 500" },
              { "s": "CME:6E1!", "d": "Euro" },
              { "s": "COMEX:GC1!", "d": "Gold" },
              { "s": "NYMEX:CL1!", "d": "WTI Crude Oil" },
              { "s": "NYMEX:NG1!", "d": "Natural Gas" },
              { "s": "CBOT:ZC1!", "d": "Corn" }
            ],
            "originalTitle": "Futures"
          },
          {
            "title": "Bonds",
            "symbols": [
              { "s": "CBOT:ZB1!", "d": "T-Bond" },
              { "s": "CBOT:UB1!", "d": "Ultra T-Bond" },
              { "s": "EUREX:FGBL1!", "d": "Euro Bund" },
              { "s": "EUREX:FBTP1!", "d": "Euro BTP" },
              { "s": "EUREX:FGBM1!", "d": "Euro BOBL" }
            ],
            "originalTitle": "Bonds"
          },
          {
            "title": "Forex",
            "symbols": [
              { "s": "FX:EURUSD", "d": "EUR to USD" },
              { "s": "FX:GBPUSD", "d": "GBP to USD" },
              { "s": "FX:USDJPY", "d": "USD to JPY" },
              { "s": "FX:USDCHF", "d": "USD to CHF" },
              { "s": "FX:AUDUSD", "d": "AUD to USD" },
              { "s": "FX:USDCAD", "d": "USD to CAD" }
            ],
            "originalTitle": "Forex"
          },
          {
            "title": "Crypto",
            "symbols": [
              { "s": "BINANCE:BTCUSDT" },
              { "s": "BINANCE:ETHUSDT" },
              { "s": "BINANCE:BNBUSDT" },
              { "s": "BINANCE:XRPUSDT" },
              { "s": "BINANCE:ADAUSDT" },
              { "s": "BINANCE:DOGEUSDT" }
            ]
          }
        ],
        "support_host": "https://www.tradingview.com"
      });

      const widgetDiv = document.createElement('div');
      widgetDiv.className = 'tradingview-widget-container__widget';
      el.appendChild(widgetDiv);
      
      const copyrightDiv = document.createElement('div');
      copyrightDiv.className = 'tradingview-widget-copyright';
      copyrightDiv.innerHTML = `
        <a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank">
          <span class="blue-text">Market data by TradingView</span>
        </a>
      `;
      el.appendChild(copyrightDiv);
      
      el.appendChild(script);
    }

    // Cleanup: destroy iframe and script on unmount to free memory
    return () => {
      if (el) el.innerHTML = '';
    };
  }, []); // Empty dependency array as we want to mount once

  if (hasError) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-center space-y-3">
          <p className="text-sm text-gray-600">Market overview temporarily unavailable</p>
          <p className="text-xs text-gray-500">Please check your connection and try again</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="tradingview-widget-container w-full"
      ref={container}
    />
  );
}

export default memo(TradingViewMarketOverviewWidget);
