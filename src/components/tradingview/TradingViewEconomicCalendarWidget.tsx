import React, { useEffect, useRef, memo, useState } from 'react';

function TradingViewEconomicCalendarWidget() {
  const container = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState(false);

  // Create TradingView script when dimensions change
  useEffect(() => {
    const el = container.current;
    // Clean up previous script if any
    if (el) {
      el.innerHTML = '';
      
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
      script.type = "text/javascript";
      script.async = true;

      // Graceful fallback if external script fails to load
      script.onerror = () => {
        console.debug('[TradingView] Economic calendar widget script failed to load.');
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
        "isTransparent": false,
        "width": dimensions.width,
        "height": dimensions.height,
        "locale": "en",
        "importanceFilter": "-1,0,1",
        "currencyFilter": "USD,EUR,GBP,JPY,AUD,CAD,CHF,CNY,ZAR",
        "support_host": "https://www.tradingview.com"
      });

      const widgetDiv = document.createElement('div');
      widgetDiv.className = 'tradingview-widget-container__widget';
      el.appendChild(widgetDiv);
      
      const copyrightDiv = document.createElement('div');
      copyrightDiv.className = 'tradingview-widget-copyright';
      copyrightDiv.innerHTML = `
        <a href="https://www.tradingview.com/economic-calendar/" rel="noopener nofollow" target="_blank">
          <span class="blue-text">Economic calendar by TradingView</span>
        </a>
      `;
      el.appendChild(copyrightDiv);
      
      el.appendChild(script);
    }

    // Cleanup: destroy iframe and script on unmount to free memory
    return () => {
      if (el) el.innerHTML = '';
    };
  }, []);

  if (hasError) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-50 rounded-lg border border-gray-200">
        <div className="text-center space-y-3">
          <p className="text-sm text-gray-600">Economic calendar temporarily unavailable</p>
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

export default memo(TradingViewEconomicCalendarWidget);