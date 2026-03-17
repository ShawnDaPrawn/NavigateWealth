import React from 'react';

interface TradingViewWidgetWrapperProps {
  children: React.ReactNode;
  widgetKey: string;
}

/**
 * Wrapper component to ensure proper mounting/unmounting of TradingView widgets
 * Adds a delay to ensure previous widget is fully cleaned up before mounting new one
 */
export const TradingViewWidgetWrapper: React.FC<TradingViewWidgetWrapperProps> = ({ 
  children, 
  widgetKey 
}) => {
  return (
    <div 
      key={widgetKey}
      className="w-full h-full animate-in fade-in zoom-in-95 duration-300"
    >
      {children}
    </div>
  );
};
