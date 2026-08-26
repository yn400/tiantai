import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center h-full text-center px-8" role="alert">
            <span className="text-5xl mb-4">🌑</span>
            <h2 className="text-lg font-xiaowei text-warm-50 mb-2">出错了</h2>
            <p className="text-xs text-warm-300 mb-6 leading-relaxed">
              天台的风有点大，但一切都会好的。
              <br />
              试试刷新页面吧。
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 rounded-full bg-white/10 border border-white/20 text-warm-50 text-sm hover:bg-white/15 transition-colors"
              aria-label="刷新页面"
            >
              刷新
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
