import { useEffect, useRef, memo, useState } from 'react';

function TradingViewForexWidget() {
  const container = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState(false);

  // Create TradingView script when dimensions change
  useEffect(() => {
    const el = container.current;
    // Clean up previous script if any
    if (el) {
      el.innerHTML = '';

      const script = document.createElement('script');
      script.src =
        'https://s3.tradingview.com/external-embedding/embed-widget-forex-cross-rates.js';
      script.type = 'text/javascript';
      script.async = true;

      // Graceful fallback if external script fails to load
      script.onerror = () => {
        logger.debug('[TradingView] Forex widget script failed to load.');
        setHasError(true);
      };

      // Calculate responsive dimensions
      const width = window.innerWidth;
      const dimensions = {
        width: '100%',
        height:
          width >= 1536
            ? '800'
            : width >= 1280
              ? '700'
              : width >= 1024
                ? '650'
                : width >= 768
                  ? '600'
                  : '500',
      };

      script.innerHTML = JSON.stringify({
        width: dimensions.width,
        height: dimensions.height,
        currencies: ['EUR', 'USD', 'JPY', 'GBP', 'CHF', 'AUD', 'CAD', 'NZD'],
        isTransparent: false,
        colorTheme: 'light',
        locale: 'en',
        support_host: 'https://www.tradingview.com',
      });

      const widgetDiv = document.createElement('div');
      widgetDiv.className = 'tradingview-widget-container__widget';
      el.appendChild(widgetDiv);

      const copyrightDiv = document.createElement('div');
      copyrightDiv.className = 'tradingview-widget-copyright';
      copyrightDiv.innerHTML = `
        <a href="https://www.tradingview.com/markets/currencies/cross-rates-overview-prices/" rel="noopener nofollow" target="_blank">
          <span class="blue-text">Forex market by TradingView</span>
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
          <p className="text-sm text-gray-600">Forex data temporarily unavailable</p>
          <p className="text-xs text-gray-500">Please check your connection and try again</p>
        </div>
      </div>
    );
  }

  return <div className="tradingview-widget-container w-full" ref={container} />;
}

export default memo(TradingViewForexWidget);
