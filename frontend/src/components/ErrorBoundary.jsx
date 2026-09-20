import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Unhandled render error:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-sand-50 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-ink-900/5 to-ink-900/10 text-ink-500">
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-ink-900">Something went wrong</h1>
        <p className="max-w-sm text-sm text-ink-500">
          An unexpected error occurred. Try reloading the page — if the problem continues, contact support.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-800"
        >
          Reload page
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
