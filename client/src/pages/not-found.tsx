import { Link } from "wouter";
import { AlertCircle, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4" data-testid="page-not-found">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
          <AlertCircle className="h-10 w-10 text-destructive/70" />
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">404 — Signal Lost</p>
          <h1 className="mt-2 text-3xl font-display font-bold text-white">This route is uncharted</h1>
          <p className="mt-3 text-sm font-mono text-muted-foreground">
            The page you requested doesn't exist on the ARK platform — or it moved during a recent deployment.
          </p>
        </div>
        <Link
          href="/"
          data-testid="link-home"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-mono text-sm uppercase tracking-wider px-6 py-3 rounded-lg transition-all hover:scale-[1.02]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>
      </div>
    </div>
  );
}
