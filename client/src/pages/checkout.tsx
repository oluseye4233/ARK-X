import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@shared/schema";
import { CreditCard, Lock, X, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

type Step = "loading" | "form" | "processing" | "complete" | "failed" | "error";
type Session = {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  amountCents: number;
  status: string;
  externalSessionId: string | null;
  institution: string | null;
};

export default function CheckoutPage() {
  const [, params] = useRoute("/checkout/:id");
  const [, setLocation] = useLocation();
  const { updateUser } = useAuth();
  const [step, setStep] = useState<Step>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cardNum, setCardNum] = useState("4242 4242 4242 4242");
  const [expiry, setExpiry] = useState("12/28");
  const [cvc, setCvc] = useState("123");

  useEffect(() => {
    if (!params?.id) return;
    api.getCheckoutSession(params.id)
      .then((s: Session) => {
        setSession(s);
        if (s.status === "completed") setStep("complete");
        else if (s.status === "failed" || s.status === "canceled") setStep("failed");
        else setStep("form");
      })
      .catch((e) => {
        setErrorMsg(e.message || "Could not load checkout session.");
        setStep("error");
      });
  }, [params?.id]);

  const submit = async (success: boolean) => {
    if (!session) return;
    setStep("processing");
    setErrorMsg(null);
    await new Promise((r) => setTimeout(r, success ? 1400 : 700));
    try {
      const r = await api.completeCheckout(session.id, success);
      if (r.ok) {
        updateUser({
          subscriptionPlan: session.plan,
          subscriptionStatus: "active",
          ...(session.institution ? { institution: session.institution } : {}),
        } as any);
        setStep("complete");
        setTimeout(() => setLocation("/subscription"), 1600);
      } else {
        setStep("failed");
      }
    } catch (e: any) {
      if (e.message?.toLowerCase().includes("payment failed")) {
        setStep("failed");
      } else {
        setErrorMsg(e.message || "Checkout failed.");
        setStep("error");
      }
    }
  };

  const planData = session ? SUBSCRIPTION_PLANS[session.plan] : null;
  const dollars = session ? (session.amountCents / 100).toFixed(2) : "0.00";

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-card rounded-2xl w-full max-w-md overflow-hidden"
        data-testid="page-checkout"
      >
        {step === "loading" && (
          <div className="p-12 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="font-mono text-sm text-muted-foreground uppercase tracking-widest">Loading checkout</p>
          </div>
        )}

        {step === "error" && (
          <div className="p-8 space-y-4 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <p className="font-display font-bold text-white uppercase tracking-wide" data-testid="text-checkout-error">{errorMsg}</p>
            <button
              onClick={() => setLocation("/subscription")}
              className="px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wide border border-white/20 text-white hover:bg-white/10"
              data-testid="button-back-to-plans"
            >
              Back to Plans
            </button>
          </div>
        )}

        {step === "form" && session && planData && (
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-6 w-6 text-primary" />
                <h3 className="font-display font-bold text-xl text-white uppercase tracking-wider" data-testid="text-checkout-title">Checkout</h3>
              </div>
              <button onClick={() => setLocation("/subscription")} className="text-muted-foreground hover:text-white" data-testid="button-close-checkout">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex justify-between items-center" data-testid="card-checkout-summary">
              <div>
                <p className="font-display font-bold text-white" data-testid="text-checkout-plan">{planData.label}</p>
                <p className="text-xs text-muted-foreground font-mono mt-1">Billed {planData.period}ly · Test mode</p>
                {session.externalSessionId && (
                  <p className="text-[10px] text-muted-foreground/70 font-mono mt-1" data-testid="text-checkout-session-id">{session.externalSessionId}</p>
                )}
              </div>
              <p className="text-2xl font-display font-black text-white" data-testid="text-checkout-amount">
                ${dollars}<span className="text-sm text-muted-foreground">/{planData.period}</span>
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest block mb-2">Card Number</label>
                <input
                  data-testid="input-card-number"
                  type="text"
                  value={cardNum}
                  onChange={(e) => setCardNum(e.target.value)}
                  placeholder="4242 4242 4242 4242"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-primary/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest block mb-2">Expiry</label>
                  <input
                    data-testid="input-card-expiry"
                    type="text"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    placeholder="12/28"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest block mb-2">CVC</label>
                  <input
                    data-testid="input-card-cvc"
                    type="text"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value)}
                    placeholder="123"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => submit(true)}
                className="w-full py-4 rounded-xl font-mono text-sm uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                data-testid="button-pay"
              >
                <Lock className="h-4 w-4" />
                Pay ${dollars}
              </button>
              <button
                onClick={() => submit(false)}
                className="w-full py-2 rounded-xl font-mono text-[11px] uppercase tracking-widest border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                data-testid="button-simulate-failure"
              >
                Simulate Payment Failure
              </button>
            </div>

            <p className="text-center text-[10px] text-muted-foreground font-mono">
              STUB CHECKOUT · No real charges · Stripe integration pending
            </p>
          </div>
        )}

        {step === "processing" && (
          <div className="p-12 flex flex-col items-center justify-center space-y-4" data-testid="state-processing">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-2 border-primary/20 rounded-full" />
              <div className="absolute inset-0 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="font-display font-bold text-white text-lg uppercase tracking-widest">Processing Payment</p>
            <p className="text-xs font-mono text-muted-foreground">Contacting payment processor...</p>
          </div>
        )}

        {step === "complete" && (
          <div className="p-12 flex flex-col items-center justify-center space-y-4" data-testid="state-complete">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="w-16 h-16 rounded-full bg-secondary/20 border-2 border-secondary flex items-center justify-center"
            >
              <CheckCircle2 className="h-8 w-8 text-secondary" />
            </motion.div>
            <p className="font-display font-bold text-white text-lg uppercase tracking-widest">Payment Successful</p>
            <p className="text-xs font-mono text-muted-foreground">Activating your plan...</p>
          </div>
        )}

        {step === "failed" && (
          <div className="p-12 flex flex-col items-center justify-center space-y-4" data-testid="state-failed">
            <div className="w-16 h-16 rounded-full bg-destructive/20 border-2 border-destructive flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <p className="font-display font-bold text-white text-lg uppercase tracking-widest">Payment Failed</p>
            <p className="text-xs font-mono text-muted-foreground">Your card was declined (simulated).</p>
            <button
              onClick={() => setLocation("/subscription")}
              className="mt-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wide border border-white/20 text-white hover:bg-white/10"
              data-testid="button-back-after-failure"
            >
              Back to Plans
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
