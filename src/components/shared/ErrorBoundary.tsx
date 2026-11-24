/* eslint-disable react-refresh/only-export-components */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Home, ShieldCheck } from 'lucide-react';
import { StatusScreen } from './StatusScreen';
import { logger } from '../../utils/logger';
import {
  markErrorReported,
  reportRuntimeClientIssue,
} from '../../utils/quality/runtimeIssueReporter';
import {
  isDefinitiveStaleChunkLoadFailure,
  isStaleChunkLoadFailure,
  reloadOnceForStaleChunk,
} from '../../utils/staleChunkRecovery';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  showDetails?: boolean;
  /** When true, renders a compact error card suitable for inline content areas
   *  (e.g. inside a layout) instead of a full-screen takeover. */
  inline?: boolean;
  /**
   * Custom fallback (e.g. the admin's standard ErrorState). Gets the error,
   * a reset that re-renders the children, a reload for a stale build, and
   * whether the failure was a stale chunk. Reporting and stale-chunk
   * recovery still happen as usual.
   */
  renderFallback?: (args: {
    error: Error | null;
    reset: () => void;
    reload: () => void;
    isStaleChunk: boolean;
  }) => ReactNode;
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
    // Stale-deploy chunk failures: reload once instead of recording a
    // runtime issue. The same fingerprint was filling Issue Manager after
    // every Vercel publish while an old tab still held the previous shell.
    // Always skip reporting for this error class, even when a sibling
    // boundary already used up this tab's one reload in the last 60s —
    // otherwise the second of two simultaneous stale-chunk crashes (e.g.
    // two lazy boundaries failing on the same stale deploy) still gets
    // logged as a "real" issue.
    if (isStaleChunkLoadFailure(error)) {
      reloadOnceForStaleChunk();
      // The ambiguous React #283/#306 case (see staleChunkRecovery.ts) still
      // gets a reload, but falls through to report below — it can also be a
      // genuine lazy-miswiring bug that a reload will not fix, and that
      // would otherwise vanish from Issue Manager entirely.
      if (isDefinitiveStaleChunkLoadFailure(error)) {
        return;
      }
    }

    // Marked BEFORE logging: logger.error forwards to the issue reporter,
    // which would otherwise file this crash a second time as a handled error.
    // The boundary's own report below is the richer one (component stack).
    markErrorReported(error);

    // Log using unified logger
    logger.error('ErrorBoundary caught an error', error, {
      componentStack: errorInfo.componentStack,
    });

    void reportRuntimeClientIssue({
      kind: 'react-error-boundary',
      title: error.name || 'React render error',
      message: error.message || 'React render error',
      stack: error.stack,
      componentStack: errorInfo.componentStack ?? undefined,
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

  handleReload = () => {
    window.location.reload();
  };

  private isDynamicImportError(error: Error | null): boolean {
    return isStaleChunkLoadFailure(error);
  }

  private isDevelopment(): boolean {
    return import.meta.env?.DEV || false;
  }

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallbackTitle, fallbackMessage, showDetails, inline } = this.props;

    if (hasError && this.props.renderFallback) {
      return this.props.renderFallback({
        error,
        reset: this.handleReset,
        reload: this.handleReload,
        isStaleChunk: this.isDynamicImportError(error),
      });
    }

    if (hasError) {
      const showTechDetails = this.isDevelopment() || showDetails;
      const isStale = this.isDynamicImportError(error);
      const layout = inline ? 'inline' : 'page';

      // A deploy has replaced the files this tab was built from. Nothing is
      // broken: the page just has to load the new version.
      if (isStale) {
        return (
          <StatusScreen
            variant="update"
            layout={layout}
            role="alert"
            focusPrimary={!inline}
            eyebrow="Update available"
            title="A new version is ready"
            lead={
              <p>
                Navigate Wealth was updated after this page was opened. Refresh to load the latest
                version.
              </p>
            }
            actions={[{ label: 'Refresh now', icon: RefreshCw, onClick: this.handleReload }]}
            note={
              <>
                <ShieldCheck aria-hidden="true" />
                <span>
                  <strong>You&apos;ll stay signed in.</strong> Anything you hadn&apos;t saved on
                  this page may need to be entered again.
                </span>
              </>
            }
          />
        );
      }

      // The error's own text is for support, not the headline: it is often a
      // raw engine message. It sits in the folded technical details, with the
      // stacks only in development or where a boundary asks for them.
      const details =
        error && (error.message || showTechDetails) ? (
          <>
            <strong>
              {error.name}: {error.message}
            </strong>
            {showTechDetails && error.stack ? <div>{error.stack}</div> : null}
            {showTechDetails && errorInfo?.componentStack ? (
              <div>
                <strong>Component stack</strong>
                <div>{errorInfo.componentStack}</div>
              </div>
            ) : null}
          </>
        ) : undefined;

      return (
        <StatusScreen
          variant="error"
          layout={layout}
          role="alert"
          focusPrimary={!inline}
          eyebrow={fallbackTitle || (inline ? 'Page error' : 'Application error')}
          title={inline ? "This page didn't load" : 'Something went wrong'}
          lead={
            <p>
              {fallbackMessage ||
                (inline
                  ? 'Something went wrong while showing this page. Try again, or head back home — the rest of Navigate Wealth is still working.'
                  : 'Navigate Wealth ran into an unexpected problem. Try again, or refresh the page.')}
            </p>
          }
          actions={[
            { label: 'Try again', icon: RefreshCw, onClick: this.handleReset },
            { label: 'Return home', icon: Home, onClick: this.handleGoHome },
          ]}
          note={
            <>
              <ShieldCheck aria-hidden="true" />
              <span>
                <strong>We&apos;ve been notified.</strong> If it keeps happening, contact your
                adviser or our team and we&apos;ll help.
              </span>
            </>
          }
          details={details}
        />
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
  errorBoundaryProps?: Omit<Props, 'children'>,
) {
  return function WithErrorBoundaryComponent(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
