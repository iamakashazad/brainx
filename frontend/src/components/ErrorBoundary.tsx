import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  /** Rendered instead of `children` after a render error. */
  fallback: (error: Error) => ReactNode;
  /** Changing this clears a caught error (e.g. pass the route path). */
  resetKey?: unknown;
  children: ReactNode;
};

type ErrorBoundaryState = { error: Error | null; resetKey: unknown };

/**
 * Without a boundary, React 19 unmounts the whole root on a render error — a
 * WebGL context failure inside the brain canvas used to blank the entire app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Render error caught by ErrorBoundary", error, info.componentStack);
  }

  render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
  }
}
