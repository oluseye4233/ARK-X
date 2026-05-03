import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background px-4" data-testid="error-boundary">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <AlertTriangle className="h-10 w-10 text-destructive/70" />
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">500 — Runtime Fault</p>
            <h1 className="mt-2 text-3xl font-display font-bold text-white">Something broke on our end</h1>
            <p className="mt-3 text-sm font-mono text-muted-foreground">
              An unexpected error occurred while rendering this view. The team has been notified in the logs.
            </p>
            {this.state.error?.message && (
              <pre className="mt-4 text-xs font-mono text-muted-foreground/70 bg-muted/30 p-3 rounded border border-border overflow-auto max-h-32 text-left" data-testid="error-message">
                {this.state.error.message}
              </pre>
            )}
          </div>
          <button
            onClick={this.handleReset}
            data-testid="button-error-reset"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-sm uppercase tracking-wider px-6 py-3 rounded-lg transition-all hover:scale-[1.02]"
          >
            <RotateCcw className="h-4 w-4" /> Reload Home
          </button>
        </div>
      </div>
    );
  }
}
