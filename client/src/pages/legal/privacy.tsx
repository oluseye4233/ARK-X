import { Link } from "wouter";
import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-12" data-testid="page-privacy">
      <div className="max-w-3xl mx-auto">
        <Link href="/" data-testid="link-home" className="inline-flex items-center gap-2 text-muted-foreground hover:text-white font-mono text-xs uppercase tracking-wider mb-6">
          <ArrowLeft className="h-3 w-3" /> Home
        </Link>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">ARK Platform</p>
            <h1 className="text-3xl font-display font-bold text-white">Privacy Policy</h1>
          </div>
        </div>
        <p className="font-mono text-xs text-muted-foreground mb-8">Last updated: May 3, 2026</p>

        <div className="prose prose-invert max-w-none space-y-6 font-mono text-sm text-muted-foreground">
          <section>
            <h2 className="text-white font-display text-xl mb-3">1. What We Collect</h2>
            <p>When you create an ARK account we store your email, display name, role, department, seniority, location, and a hashed password. When you upload a resume we extract structured fields (skills, titles, dates, employers) and store them alongside your account. When you play CCGE sessions, complete assessments, or interact with SPHINX listings we record those events to power your ARK Score and Flywheel feed.</p>
          </section>

          <section>
            <h2 className="text-white font-display text-xl mb-3">2. How We Use It</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Generate your KCSE, CCMI, JST, and ARK Score signals.</li>
              <li>Power your personalized dashboard, pathways, and report.</li>
              <li>Process subscription billing and surface relevant SPHINX content.</li>
              <li>Detect abuse and enforce per-tier usage budgets (e.g., AI token limits).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-display text-xl mb-3">3. AI Processing</h2>
            <p>Resume narrative generation and certain CCGE scoring paths invoke Anthropic Claude. Inputs are sent to Anthropic under their data-processing terms; we do not train models on your data and we do not retain prompts beyond a 24-hour cache used to deduplicate identical requests.</p>
          </section>

          <section>
            <h2 className="text-white font-display text-xl mb-3">4. Sharing</h2>
            <p>We do not sell your data. We share data only with sub-processors required to operate the service: our database host (Replit Postgres), our payment processor (Stripe — once enabled), and Anthropic for AI features. Public profile data on <code>/u/:username</code> is only shown if you opt into a public GUIN+ identity.</p>
          </section>

          <section>
            <h2 className="text-white font-display text-xl mb-3">5. Your Rights (GDPR / CCPA)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li><strong className="text-white">Access</strong> — request a full JSON export of your data via the Profile page (calls <code>GET /api/users/me/export</code>).</li>
              <li><strong className="text-white">Deletion</strong> — request permanent account deletion via the Profile page (calls <code>DELETE /api/users/me</code>). This cascades across assessments, game sessions, billing history, ARK events, and AI usage logs.</li>
              <li><strong className="text-white">Correction</strong> — edit your profile fields directly at any time.</li>
              <li><strong className="text-white">Portability</strong> — your export is structured JSON suitable for migration.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-display text-xl mb-3">6. Retention</h2>
            <p>We retain account data while your account is active and for 30 days after deletion to satisfy billing reconciliation. Anonymized aggregate analytics (no user-identifying fields) may be retained indefinitely.</p>
          </section>

          <section>
            <h2 className="text-white font-display text-xl mb-3">7. Security</h2>
            <p>Sessions are HttpOnly + SameSite=Lax cookies signed with a server-side secret. Passwords are hashed with bcrypt. Mutating endpoints are rate-limited and protected by helmet security headers. Production traffic terminates over TLS 1.2+.</p>
          </section>

          <section>
            <h2 className="text-white font-display text-xl mb-3">8. Contact</h2>
            <p>Questions or requests: <a href="mailto:privacy@arkplatform.example" className="text-primary hover:underline">privacy@arkplatform.example</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
