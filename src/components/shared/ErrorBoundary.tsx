import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { logger } from '../../utils/logger';
import { AppError } from '../../shared/types/logger';
import { reportRuntimeClientIssue } from '../../utils/quality/runtimeIssueReporter';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  showDetails?: boolean;
  /** When true, renders a compact error card suitable for inline content areas
   *  (e.g. inside a layout) instead of a full-screen takeover. */
  inline?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary - Global Error Handler
 * 
 * Catches render-phase errors and displays a user-friendly fallback.
 * Logs errors to the unified logging system.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log using unified logger
    logger.error('ErrorBoundary caught an error', error, {
      componentStack: errorInfo.componentStack,
    });

    void reportRuntimeClientIssue({
      kind: 'react-error-boundary',
      title: error.name || 'React render error',
      message: error.message || 'React render error',
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      filePath: window.location.pathname,
    });
    
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    const { onReset } = this.props;
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (onReset) {
      onReset();
    }
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  private isDevelopment(): boolean {
    // @ts-ignore
    return import.meta.env?.DEV || false;
  }

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallbackTitle, fallbackMessage, showDetails, inline } = this.props;

    if (hasError) {
      const showTechDetails = this.isDevelopment() || showDetails;

      // Inline variant: renders within a layout's content area, preserving nav/footer
      if (inline) {
        return (
          <div className="flex items-center justify-center p-8 py-16" role="alert">
            <Card className="max-w-xl w-full border-red-100 shadow-lg">
              <CardHeader className="space-y-1">
                <div className="flex items-center gap-2 text-red-600 mb-2">
                  <ShieldAlert className="h-5 w-5" />
                  <span className="font-semibold uppercase tracking-wider text-xs">Section Error</span>
                </div>
                <CardTitle className="text-lg">
                  {fallbackTitle || 'Unable to load this section'}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-900">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error Detected</AlertTitle>
                  <AlertDescription>
                    {fallbackMessage || error?.message || 'An unexpected error occurred. Please try again.'}
                  </AlertDescription>
                </Alert>

                {showTechDetails && error && (
                  <div className="space-y-2">
                    <div className="text-xs font-mono bg-slate-950 text-slate-50 p-3 rounded-md overflow-auto max-h-[200px]">
                      <div className="mb-2 font-bold text-red-400">{error.name}: {error.message}</div>
                      <div className="opacity-70 whitespace-pre-wrap">{error.stack}</div>
                    </div>
                  </div>
                )}

                <div className="text-sm text-muted-foreground">
                  <p>You can try refreshing this section. The rest of the site remains available.</p>
                </div>
              </CardContent>

              <CardFooter className="flex gap-3 justify-end border-t bg-gray-50/50 p-4">
                <Button onClick={this.handleGoHome} variant="outline" size="sm" className="gap-2">
                  <Home className="h-4 w-4" />
                  Return Home
                </Button>
                <Button onClick={this.handleReset} variant="default" size="sm" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
              </CardFooter>
            </Card>
          </div>
        );
      }

      // Full-page variant (default): replaces entire viewport
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50/50" role="alert">
          <Card className="max-w-xl w-full border-red-100 shadow-lg">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <ShieldAlert className="h-6 w-6" />
                <span className="font-semibold uppercase tracking-wider text-xs">System Error</span>
              </div>
              <CardTitle className="text-xl">
                {fallbackTitle || 'Unable to load this section'}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-900">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Detected</AlertTitle>
                <AlertDescription>
                  {fallbackMessage || error?.message || 'An unexpected error occurred. Our team has been notified.'}
                </AlertDescription>
              </Alert>

              {showTechDetails && error && (
                <div className="space-y-2">
                  <div className="text-xs font-mono bg-slate-950 text-slate-50 p-4 rounded-md overflow-auto max-h-[300px]">
                    <div className="mb-2 font-bold text-red-400">{error.name}: {error.message}</div>
                    <div className="opacity-70 whitespace-pre-wrap">{error.stack}</div>
                    {errorInfo && (
                      <div className="contents">
                        <div className="mt-4 font-bold text-yellow-400">Component Stack:</div>
                        <div className="opacity-70 whitespace-pre-wrap">{errorInfo.componentStack}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                <p>Please try refreshing the page. If the problem persists, contact support.</p>
              </div>
            </CardContent>

            <CardFooter className="flex gap-3 justify-end border-t bg-gray-50/50 p-6">
              <Button onClick={this.handleGoHome} variant="outline" className="gap-2">
                <Home className="h-4 w-4" />
                Return Home
              </Button>
              <Button onClick={this.handleReset} variant="default" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return children;
  }
}

/**
 * HOC to wrap a component with ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  return function WithErrorBoundaryComponent(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
