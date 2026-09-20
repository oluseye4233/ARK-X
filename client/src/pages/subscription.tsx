import { useState, useEffect } from "react";
import { FEATURES } from "@shared/featureFlags";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import { SUBSCRIPTION_PLANS, F1000_PROMO, type BillingInterval, type SubscriptionPlan } from "@shared/schema";
import {
  Crown,
  GraduationCap,
  User,
  Building2,
  Hammer,
  Check,
  Zap,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Shield,
  AlertTriangle,
  Compass,
} from "lucide-react";

const PLAN_ICONS: Record<string, typeof User> = {
  INDIVIDUAL_FREE: User,
  INDIVIDUAL_EXPLORER: Compass,
  INDIVIDUAL_PRO: Crown,
  SCHOOL_STUDENT: GraduationCap,
  ENTERPRISE: Building2,
  ARCHITECT: Hammer,
};

type PlanSwitchPreview = {
  plan: SubscriptionPlan;
  fromPlan: SubscriptionPlan;
  prorationAmountCents: number;
  currency: string;
  nextBillingAt: string;
  expiresAt: string;
  previewToken: string;
};

export function getCancellationMessage({
  effectiveAt,
  alreadyScheduled,
}: {
  effectiveAt: string;
  alreadyScheduled?: boolean;
}): string {
  const endDateMessage = `Subscription will end on ${new Date(effectiveAt).toLocaleDateString()}.`;
  return alreadyScheduled
    ? `Cancellation was already scheduled. ${endDateMessage}`
    : endDateMessage;
}

export default function SubscriptionPage() {
  const { user, updateUser, refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan>("INDIVIDUAL_FREE");
  const [isUpdating, setIsUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [switchNotice, setSwitchNotice] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [institution, setInstitution] = useState("");
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("month");
  const [switchPreview, setSwitchPreview] = useState<PlanSwitchPreview | null>(null);
  const [previewRefreshNotice, setPreviewRefreshNotice] = useState(false);

  const f1000Query = useQuery<{ member: boolean }>({
    queryKey: ["/api/f1000/me"],
    queryFn: () => api.getF1000Me(),
    enabled: FEATURES.f1000Promo && !!user,
    refetchOnWindowFocus: false,
  });
  const billingQuery = useQuery<{
    plan: SubscriptionPlan;
    status: string;
    paidCheckoutAvailable: boolean;
    mode: "demo" | "live";
    stripeSubscriptionId: string | null;
  }>({
    queryKey: ["/api/billing/me"],
    queryFn: () => api.getBillingMe(),
    enabled: !!user,
    refetchOnWindowFocus: false,
  });
  const paidCheckoutAvailable = billingQuery.data?.paidCheckoutAvailable === true;
  const isF1000 = !!f1000Query.data?.member;
  const promoPriceFor = (key: SubscriptionPlan): number | null =>
    isF1000 && F1000_PROMO.priceUsd[key] != null ? F1000_PROMO.priceUsd[key] : null;
  const promoAiUsdFor = (key: SubscriptionPlan): number | null =>
    isF1000 && F1000_PROMO.aiCostBudgetCents[key] != null
      ? Math.round(F1000_PROMO.aiCostBudgetCents[key] / 100)
      : null;

  useEffect(() => {
    if (user?.subscriptionPlan) {
      setCurrentPlan(user.subscriptionPlan as SubscriptionPlan);
    }
    if (user?.institution) {
      setInstitution(user.institution);
    }
  }, [user]);

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (!user) return;
    setErrorMsg(null);
    setIsUpdating(true);
    try {
      const isSwitch = !!billingQuery.data?.stripeSubscriptionId &&
        SUBSCRIPTION_PLANS[currentPlan].price > 0 &&
        SUBSCRIPTION_PLANS[plan].price > 0;
      if (isSwitch) {
        const preview = await api.previewSubscriptionSwitch(
          plan,
          plan === "SCHOOL_STUDENT" ? institution : undefined,
          billingInterval,
        );
        setSwitchPreview(preview);
        setPreviewRefreshNotice(false);
        return;
      }
      const session = await api.startCheckout(
        plan,
        plan === "SCHOOL_STUDENT" ? institution : undefined,
        billingInterval,
      );
      if (!session.requiresPayment) {
        await api.completeCheckout(session.sessionId, true);
        const billing = await api.getBillingMe();
        setCurrentPlan(billing.plan);
        updateUser({ subscriptionPlan: billing.plan, subscriptionStatus: billing.status });
        await refreshUser();
        setSuccessMessage("Subscription updated successfully. Your new plan features are now active.");
        setSelectedPlan(null);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        window.location.assign(session.redirectUrl);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to start checkout.");
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmPlanSwitch = async () => {
    if (!switchPreview) return;
    setErrorMsg(null);
    setIsUpdating(true);
    try {
        const result = await api.switchSubscription(switchPreview.previewToken);
        const proration = new Intl.NumberFormat(undefined, {
          style: "currency", currency: result.currency || "USD",
        }).format(Math.abs(result.prorationAmountCents) / 100);
        setCurrentPlan(result.plan);
        updateUser({ subscriptionPlan: result.plan, subscriptionStatus: "active" });
        await refreshUser();
        setSelectedPlan(null);
        setSwitchPreview(null);
        setPreviewRefreshNotice(false);
        setSuccessMessage("Subscription updated successfully. Your new plan features are now active.");
        setSwitchNotice(
          `Plan changed immediately. Stripe added ${result.prorationAmountCents >= 0 ? `a ${proration} prorated charge` : `a ${proration} prorated credit`} to your next invoice. ` +
          `Your next regular billing date is ${new Date(result.nextBillingAt).toLocaleDateString()}.`,
        );
        setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      if (
        err.code === "PREVIEW_EXPIRED" ||
        err.code === "PREVIEW_STALE" ||
        err.code === "SUBSCRIPTION_VERSION_CONFLICT"
      ) {
        try {
          const refreshed = await api.previewSubscriptionSwitch(
            switchPreview.plan,
            switchPreview.plan === "SCHOOL_STUDENT" ? institution : undefined,
            billingInterval,
          );
          setSwitchPreview(refreshed);
          setPreviewRefreshNotice(true);
        } catch (refreshError: any) {
          setSwitchPreview(null);
          setErrorMsg(refreshError.message || "Failed to refresh the price preview.");
        }
      } else {
        setErrorMsg(err.message || "Failed to change plans.");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (!user) return;
    if (!confirm("Cancel your subscription? You'll keep access until the end of the current period.")) return;
    setIsUpdating(true);
    setErrorMsg(null);
    setSuccessMessage(null);
    try {
      const r = await api.cancelSubscription();
      updateUser({ subscriptionStatus: "canceling" });
      setSuccessMessage(getCancellationMessage(r));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Cancel failed.");
    } finally {
      setIsUpdating(false);
    }
  };

  const plans = (Object.entries(SUBSCRIPTION_PLANS) as [SubscriptionPlan, typeof SUBSCRIPTION_PLANS[SubscriptionPlan]][])
    .filter(([key]) => key !== "INDIVIDUAL_EXPLORER");
  const currentPlanData = SUBSCRIPTION_PLANS[currentPlan];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-primary tracking-widest uppercase" data-testid="text-subscription-title">
          Subscription Plans
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-2">
          SELECT YOUR ACCESS TIER // Secure checkout by Stripe
        </p>
      </div>

      {!paidCheckoutAvailable && (
        <div className="glass-card p-4 rounded-xl border border-amber-400/30 bg-amber-400/5 flex items-start gap-3" data-testid="alert-paid-checkout-demo">
          <AlertTriangle className="h-5 w-5 text-amber-300 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-mono text-sm text-amber-200 uppercase tracking-wide">Paid checkout unavailable</p>
            <p className="text-sm text-muted-foreground mt-1">
              Stripe is temporarily unavailable. Paid checkout is disabled and no paid access can be activated.
            </p>
          </div>
        </div>
      )}

      {!errorMsg && (
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              role="status"
              className="glass-card p-4 rounded-xl border border-secondary/30 bg-secondary/5 flex items-center gap-3"
              data-testid="alert-subscription-updated"
            >
              <CheckCircle2 className="h-5 w-5 text-secondary flex-shrink-0" />
              <span className="font-mono text-sm text-secondary">
                {successMessage}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-white/10 bg-black/30 p-1" data-testid="billing-interval-toggle">
          {(["month", "year"] as const).map((interval) => (
            <button
              key={interval}
              type="button"
              onClick={() => setBillingInterval(interval)}
              className={`rounded-md px-5 py-2 font-mono text-xs uppercase tracking-widest transition-colors ${
                billingInterval === interval ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-white"
              }`}
              aria-pressed={billingInterval === interval}
              data-testid={`button-billing-${interval}`}
            >
              {interval === "month" ? "Monthly" : "Annual · Save 17%"}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card p-6 rounded-xl" data-testid="card-current-plan">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${currentPlanData.color}15`, border: `2px solid ${currentPlanData.color}40` }}
          >
            {(() => {
              const Icon = PLAN_ICONS[currentPlan] || User;
              return <Icon className="h-7 w-7" style={{ color: currentPlanData.color }} />;
            })()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="font-display font-bold text-xl text-white" data-testid="text-current-plan">
                {currentPlanData.label}
              </h2>
              <span
                className="px-2 py-0.5 rounded text-xs font-mono font-bold uppercase"
                style={{ color: currentPlanData.color, backgroundColor: `${currentPlanData.color}15`, border: `1px solid ${currentPlanData.color}30` }}
                data-testid="text-subscription-status"
              >
                {user?.subscriptionStatus === "canceling" ? "CANCELING" : (user?.subscriptionStatus || "ACTIVE").toUpperCase()}
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {currentPlanData.price === 0
                ? currentPlan === "ENTERPRISE" ? "Custom pricing" : "Free tier"
                : `$${currentPlanData.price}/${currentPlanData.period}`
              }
              {user?.institution && currentPlan === "SCHOOL_STUDENT" && (
                <span className="ml-2 text-primary/70">{user.institution}</span>
              )}
            </p>
          </div>
          {FEATURES.subscriptionCancel && currentPlanData.price > 0 && currentPlan !== "ENTERPRISE" && user?.subscriptionStatus !== "canceling" && (
            <button
              onClick={handleCancel}
              disabled={isUpdating}
              className="px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wide border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
              data-testid="button-cancel-subscription"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {switchNotice && (
          <motion.div
            key="plan-switch-notice"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            role="status"
            className="glass-card p-4 rounded-xl border border-secondary/30 bg-secondary/5 flex items-center gap-3"
            data-testid="alert-plan-switch-details"
          >
            <CheckCircle2 className="h-5 w-5 text-secondary flex-shrink-0" />
            <span className="font-mono text-sm text-secondary">{switchNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>
      {errorMsg && (
        <div
          role="alert"
          className="glass-card p-4 rounded-xl border border-destructive/30 bg-destructive/5 flex items-center gap-3"
          data-testid="alert-billing-error"
        >
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
          <span className="font-mono text-sm text-destructive">{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {plans.map(([key, planData], index) => {
          const isCurrent = key === currentPlan;
          const Icon = PLAN_ICONS[key] || User;
          const isPopular = key === "INDIVIDUAL_PRO";
          const isSchool = key === "SCHOOL_STUDENT";
           const isEnterprise = key === "ENTERPRISE";
          const isUnavailablePaidPlan = planData.price > 0 && !paidCheckoutAvailable;

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`glass-card rounded-xl overflow-hidden flex flex-col relative ${
                isCurrent ? "ring-2" : isPopular ? "ring-1 ring-primary/40" : ""
              }`}
              style={isCurrent ? { borderColor: `${planData.color}50` } : {}}
              data-testid={`card-plan-${key.toLowerCase()}`}
            >
              {isPopular && !isCurrent && (
                <div className="bg-primary text-primary-foreground text-[10px] font-mono uppercase tracking-widest text-center py-1.5 flex items-center justify-center gap-1">
                  <Sparkles className="h-3 w-3" /> Most Popular
                </div>
              )}
              {isCurrent && (
                <div className="text-[10px] font-mono uppercase tracking-widest text-center py-1.5 flex items-center justify-center gap-1" style={{ backgroundColor: `${planData.color}20`, color: planData.color }}>
                  <Shield className="h-3 w-3" /> Current Plan
                </div>
              )}

              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${planData.color}15`, border: `1px solid ${planData.color}30` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: planData.color }} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-white text-sm uppercase tracking-wide">{planData.label}</h3>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{planData.type}</span>
                  </div>
                </div>

                <div className="mb-6">
                  {planData.price === 0 ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-display font-black text-white">
                        {isEnterprise ? "Custom" : "Free"}
                      </span>
                    </div>
                  ) : (() => {
                    const promo = promoPriceFor(key);
                    const aiUsd = promoAiUsdFor(key);
                    return (
                      <div className="space-y-1">
                        <div className="flex items-baseline gap-1 flex-wrap">
                          <span className="text-3xl font-display font-black text-white">
                            ${billingInterval === "year"
                              ? (promo != null ? promo * 10 : planData.annualPrice)
                              : (promo ?? planData.price)}
                          </span>
                          <span className="text-sm text-muted-foreground font-mono">/{billingInterval === "year" ? "year" : planData.period}</span>
                          {promo != null && (
                            <>
                              <span className="ml-2 text-sm text-muted-foreground/60 font-mono line-through" data-testid={`text-original-price-${key.toLowerCase()}`}>
                                ${billingInterval === "year" ? planData.annualPrice : planData.price}
                              </span>
                              <span className="ml-1 text-[10px] font-mono uppercase tracking-widest text-primary" data-testid={`badge-f1000-price-${key.toLowerCase()}`}>
                                F1000
                              </span>
                            </>
                          )}
                        </div>
                        {aiUsd != null && (
                          <span className="text-[10px] font-mono uppercase tracking-widest text-secondary">
                            incl. ${aiUsd}/mo AI allowance
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-2.5 mb-6 flex-1">
                  {planData.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: planData.color }} />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </div>
                  ))}
                </div>

                {!isCurrent && !isEnterprise && (
                  <button
                    onClick={() => {
                      if (isSchool) {
                        setSelectedPlan(selectedPlan === key ? null : key);
                      } else {
                        handleSubscribe(key);
                      }
                    }}
                    disabled={isUpdating || isUnavailablePaidPlan}
                    className="w-full py-3 rounded-lg font-mono text-sm uppercase tracking-wide transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02]"
                    style={{
                      color: planData.color,
                      backgroundColor: `${planData.color}15`,
                      border: `1px solid ${planData.color}30`,
                    }}
                    data-testid={`button-subscribe-${key.toLowerCase()}`}
                  >
                    {isUpdating ? (
                      <Zap className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    {isUpdating ? "Processing..." : isUnavailablePaidPlan ? "Paid Checkout Unavailable" : isSchool ? "Select Plan" : SUBSCRIPTION_PLANS[currentPlan].price > 0 ? "Switch Plan" : "Subscribe"}
                  </button>
                )}

                {isEnterprise && !isCurrent && (
                  <button
                    onClick={() => setErrorMsg("Institution plans require verified organization provisioning. Contact sales to continue.")}
                    className="w-full py-3 rounded-lg font-mono text-sm uppercase tracking-wide border border-white/20 text-white"
                    data-testid="button-contact-sales"
                  >
                    Contact Sales
                  </button>
                )}


                {isCurrent && (
                  <div
                    className="w-full py-3 rounded-lg font-mono text-sm uppercase tracking-wide flex items-center justify-center gap-2"
                    style={{
                      color: planData.color,
                      backgroundColor: `${planData.color}10`,
                      border: `1px solid ${planData.color}20`,
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Active
                  </div>
                )}
              </div>

              <AnimatePresence>
                {selectedPlan === key && isSchool && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-6 pt-2 border-t border-white/10 space-y-3">
                      <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest block">
                        School / University Name
                      </label>
                      <input
                        data-testid="input-institution"
                        type="text"
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        placeholder="Enter your institution name"
                        className="w-full bg-black/40 border border-white/10 rounded-md px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
                      />
                      <button
                        onClick={() => handleSubscribe(key)}
                         disabled={isUpdating || !institution.trim() || isUnavailablePaidPlan}
                        className="w-full py-3 rounded-lg font-mono text-sm uppercase tracking-wide transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-40"
                        style={{
                          color: planData.color,
                          backgroundColor: `${planData.color}15`,
                          border: `1px solid ${planData.color}30`,
                        }}
                        data-testid="button-confirm-school-subscription"
                      >
                        {isUpdating ? (
                          <Zap className="h-4 w-4 animate-spin" />
                        ) : (
                          <GraduationCap className="h-4 w-4" />
                        )}
                         {isUpdating ? "Processing..." : isUnavailablePaidPlan ? "Paid Checkout Unavailable" : "Activate Student Plan"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <div className="glass-card p-6 rounded-xl" data-testid="card-plan-comparison">
        <h3 className="font-display font-bold text-lg text-primary uppercase tracking-widest mb-6">
          Feature Comparison
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 pr-4 font-mono text-muted-foreground uppercase tracking-wide text-xs">Feature</th>
                {plans.map(([key, planData]) => (
                  <th key={key} className="py-3 px-2 text-center">
                    <span className="font-mono text-xs uppercase tracking-wide" style={{ color: planData.color }}>
                      {planData.label.split(" ").slice(-1)[0]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { feature: "Resume Uploads", values: ["1/month", "Unlimited", "Unlimited", "Unlimited"] },
                { feature: "JST Score", values: [true, true, true, true] },
                { feature: "Full Dashboard", values: [true, true, true, true] },
                { feature: "Career Pathways", values: [false, true, true, true] },
                { feature: "FORGE Cards", values: [false, true, true, true] },
                { feature: "Executive Report", values: [false, true, true, true] },
                { feature: "Context Craft", values: [false, true, true, true] },
                { feature: "Workforce Intel", values: [false, false, false, true] },
                { feature: "Institution Dashboard", values: [false, false, true, false] },
                { feature: "Priority Support", values: [false, false, false, true] },
              ].map((row, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-3 pr-4 text-muted-foreground font-mono text-xs">{row.feature}</td>
                  {row.values.map((val, j) => (
                    <td key={j} className="py-3 px-2 text-center">
                      {typeof val === "boolean" ? (
                        val ? (
                          <Check className="h-4 w-4 mx-auto" style={{ color: plans[j][1].color }} />
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )
                      ) : (
                        <span className="text-xs font-mono text-muted-foreground">{val}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {switchPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
            data-testid="dialog-plan-switch-preview"
          >
            <div className="glass-card rounded-xl border border-primary/30 p-6 max-w-md w-full space-y-5">
              <div>
                <h2 className="font-display font-bold text-xl text-white">Confirm plan change</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Review Stripe’s exact adjustment before changing to {SUBSCRIPTION_PLANS[switchPreview.plan].label}.
                </p>
              </div>
              {previewRefreshNotice && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-amber-200" data-testid="alert-preview-refreshed">
                  The previous preview expired or became stale. Stripe refreshed the amount; please review it again.
                </div>
              )}
              <div className="rounded-lg bg-black/30 border border-white/10 p-4 space-y-3">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Prorated adjustment</span>
                  <strong className={switchPreview.prorationAmountCents < 0 ? "text-secondary" : "text-white"} data-testid="text-proration-adjustment">
                    {switchPreview.prorationAmountCents < 0 ? "Credit " : "Charge "}
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: switchPreview.currency || "USD",
                    }).format(Math.abs(switchPreview.prorationAmountCents) / 100)}
                  </strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Next renewal</span>
                  <strong className="text-white" data-testid="text-next-renewal">
                    {new Date(switchPreview.nextBillingAt).toLocaleDateString()}
                  </strong>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                This preview is valid until {new Date(switchPreview.expiresAt).toLocaleTimeString()}.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSwitchPreview(null);
                    setPreviewRefreshNotice(false);
                  }}
                  disabled={isUpdating}
                  className="flex-1 py-3 rounded-lg border border-white/20 text-white font-mono text-sm uppercase disabled:opacity-40"
                  data-testid="button-cancel-plan-switch"
                >
                  Keep current plan
                </button>
                <button
                  onClick={confirmPlanSwitch}
                  disabled={isUpdating}
                  className="flex-1 py-3 rounded-lg border border-primary/40 bg-primary/15 text-primary font-mono text-sm uppercase disabled:opacity-40"
                  data-testid="button-confirm-plan-switch"
                >
                  {isUpdating ? "Refreshing..." : "Confirm change"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
