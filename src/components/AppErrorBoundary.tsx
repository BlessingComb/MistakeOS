import { Component, type ErrorInfo, type ReactNode } from 'react';
import { trackEvent } from '../analytics';

type Props = {
  children: ReactNode;
  fallback: (retry: () => void) => ReactNode;
};

type State = { hasError: boolean };

/**
 * Keeps an unexpected render error from becoming an unexplained white screen.
 * Error details are deliberately not forwarded: they can contain learner data.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    trackEvent('app_unexpected_error', { source: 'app_boundary' });
  }

  private retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    return this.state.hasError ? this.props.fallback(this.retry) : this.props.children;
  }
}
