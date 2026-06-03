import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(err) {
    return { error: err };
  }

  componentDidCatch(err, info) {
    console.error('UI Error:', err, info?.componentStack?.slice(0, 300));
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex items-center justify-center h-full min-h-[400px] p-8">
          <div className="text-center max-w-sm">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 font-mono bg-gray-50 dark:bg-slate-800 rounded-lg p-3 text-left break-all">
              {this.state.error.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
