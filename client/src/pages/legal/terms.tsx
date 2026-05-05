import { Link } from "wouter";
import { ArrowLeft, FileText } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-12" data-testid="page-terms">
      <div className="max-w-3xl mx-auto">
        <Link href="/" data-testid="link-home" className="inline-flex items-center gap-2 text-muted-foreground hover:text-white font-mono text-xs uppercase tracking-wider mb-6">
          <ArrowLeft className="h-3 w-3" /> Home
        </Link>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">ARK Platform</p>
            <h1 className="text-3xl font-display font-bold text-white">Terms of Service</h1>
          </div>
        </div>
        <p className="font-mono text-xs text-muted-foreground mb-8">Last updated: May 3, 2026</p>

        <div className="prose prose-invert max-w-none space-y-6 font-mono text-sm text-muted-foreground">
          <section>
            <h2 className="text-white font-display text-xl mb-3">1. Acceptance</h2>
            <p>By creating an account or using ARK Platform you agree to these Terms and the linked Privacy Policy. If you do not agree, do not use the service.</p>
          </section>

          <section>
            <h2 className="text-white font-display text-xl mb-3">2. Account &amp; Eligibility</h2>
            <p>You must be 16+ (or 13+ with verified institutional supervision under a SCHOOL plan). You are responsible for safeguarding your credentials and for all activity under your account.</p>
          </section>

          <section>
            <h2 className="text-white font-display text-xl mb-3">3. Subscriptions &amp; Billing</h2>
            <p>Paid plans (Individual Pro, School / Student, Enterprise) renew monthly on the period anniversary. You may cancel at any time from <Link href="/subscription" className="text-primary hover:underline">/subscription</Link>; cancellation takes effect at the end of the current billing period and is not pro-rated. ENTERPRISE plans are provisioned via a custom contract.</p>
          </section>

          <section>
            <h2 className="text-white font-display text-xl mb-3">4. Acceptable Use</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>No scraping, automated mass-submission, or circumvention of per-tier budgets.</li>
              <li>No uploading content you do not have rights to (resumes, SPC bodies).</li>
              <li>No publishing SPHINX listings containing placeholder text, malware, or fraudulent claims.</li>
              <li>No attempting to access another user's data, sessions, or billing.</li>
            </ul>
            <p>Violations may result in immediate suspension and forfeiture of in-app credits.</p>
          </section>

          <section>
            <h2 className="text-white font-display text-xl mb-3">5. SPHINX Marketplace</h2>
            <p>Super Prompt Cards (SPCs) you publish remain your IP; you grant ARK a non-exclusive license to display, distribute, and process them on-platform. Purchases are denominated in in-app credits. Creator payouts in fiat will become available when Stripe Connect is enabled (Phase D.3).</p>
          </section>

          <section>
            <h2 className="text-white font-display text-xl mb-3">6. ARK Outputs Are Informational</h2>
            <p>KCSE, CCMI, JST, ARK Score, narrative summaries, and pathway recommendations are decision-support signals, not employment, financial, legal, or medical advice. You bear responsibility for actions taken based on these outputs.</p>
          </section>

          <section>
            <h2 className="text-white font-display text-xl mb-3">7. AI &amp; Content Disclaimers</h2>
            <p>AI-generated narratives may contain inaccuracies. We do not guarantee the correctness of Claude-generated text or scenario content. Per-tier monthly token budgets apply; exceeding them returns HTTP 429.</p>
          </section>

          <section>
            <h2 className="text-white font-display text-xl mb-3">8. Termination</h2>
            <p>You may delete your account at any time from the Profile page; deletion is irreversible and cascades across all associated records. We may terminate or suspend accounts for violations of these Terms with notice except in cases of fraud or abuse.</p>
          </section>

          <section>
            <h2 className="text-white font-display text-xl mb-3">9. Liability</h2>
            <p>The service is provided "as is" without warranty. To the maximum extent permitted by law, ARK's aggregate liability is limited to the fees you paid in the 12 months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-white font-display text-xl mb-3">10. Changes</h2>
            <p>We may update these Terms; material changes are announced via in-app banner at least 14 days before taking effect. Continued use after the effective date constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-white font-display text-xl mb-3">11. Contact</h2>
            <p>Questions: <a href="mailto:legal@arkplatform.example" className="text-primary hover:underline">legal@arkplatform.example</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
