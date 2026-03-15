import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@shared/schema";
import {
  Crown,
  GraduationCap,
  User,
  Building2,
  Check,
  Zap,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Shield,
  CreditCard,
  Lock,
  X,
} from "lucide-react";

const PLAN_ICONS: Record<string, typeof User> = {
  INDIVIDUAL_FREE: User,
  INDIVIDUAL_PRO: Crown,
  SCHOOL_STUDENT: GraduationCap,
  ENTERPRISE: Building2,
};

export default function SubscriptionPage() {
  const { user, updateUser } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan>("INDIVIDUAL_FREE");
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [institution, setInstitution] = useState("");

  useEffect(() => {
    if (user?.subscriptionPlan) {
      setCurrentPlan(user.subscriptionPlan as SubscriptionPlan);
    }
    if (user?.institution) {
      setInstitution(user.institution);
    }
  }, [user]);

  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<SubscriptionPlan | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<"form" | "processing" | "complete">("form");

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (!user) return;
    const planData = SUBSCRIPTION_PLANS[plan];
    if (planData.price > 0) {
      setCheckoutPlan(plan);
      setCheckoutStep("form");
      setShowCheckout(true);
      return;
    }
    await processSubscription(plan);
  };

  const processSubscription = async (plan: SubscriptionPlan) => {
    if (!user) return;
    setIsUpdating(true);
    try {
      await api.updateSubscription(
        user.id,
        plan,
        plan === "SCHOOL_STUDENT" ? institution : undefined
      );
      setCurrentPlan(plan);
      updateUser({
        subscriptionPlan: plan,
        subscriptionStatus: "active",
        institution: plan === "SCHOOL_STUDENT" ? institution : user.institution,
      });
      setShowSuccess(true);
      setSelectedPlan(null);
      setShowCheckout(false);
      setCheckoutPlan(null);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update subscription:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCheckoutSubmit = async () => {
    if (!checkoutPlan) return;
    setCheckoutStep("processing");
    await new Promise((r) => setTimeout(r, 2200));
    setCheckoutStep("complete");
    await new Promise((r) => setTimeout(r, 1200));
    await processSubscription(checkoutPlan);
  };

  const plans = Object.entries(SUBSCRIPTION_PLANS) as [SubscriptionPlan, typeof SUBSCRIPTION_PLANS[SubscriptionPlan]][];
  const currentPlanData = SUBSCRIPTION_PLANS[currentPlan];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-primary tracking-widest uppercase" data-testid="text-subscription-title">
          Subscription Plans
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-2">
          SELECT YOUR ACCESS TIER // Individual & School Plans Available
        </p>
      </div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card p-4 rounded-xl border border-secondary/30 bg-secondary/5 flex items-center gap-3"
            data-testid="alert-subscription-updated"
          >
            <CheckCircle2 className="h-5 w-5 text-secondary flex-shrink-0" />
            <span className="font-mono text-sm text-secondary">
              Subscription updated successfully. Your new plan features are now active.
            </span>
          </motion.div>
        )}
      </AnimatePresence>

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
              >
                ACTIVE
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
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {plans.map(([key, planData], index) => {
          const isCurrent = key === currentPlan;
          const Icon = PLAN_ICONS[key] || User;
          const isPopular = key === "INDIVIDUAL_PRO";
          const isSchool = key === "SCHOOL_STUDENT";
          const isEnterprise = key === "ENTERPRISE";

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
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-display font-black text-white">${planData.price}</span>
                      <span className="text-sm text-muted-foreground font-mono">/{planData.period}</span>
                    </div>
                  )}
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
                    disabled={isUpdating}
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
                    {isUpdating ? "Processing..." : isSchool ? "Select Plan" : "Subscribe"}
                  </button>
                )}

                {isEnterprise && !isCurrent && (
                  <button
                    className="w-full py-3 rounded-lg font-mono text-sm uppercase tracking-wide transition-all duration-300 flex items-center justify-center gap-2 opacity-60 cursor-default"
                    style={{
                      color: planData.color,
                      backgroundColor: `${planData.color}10`,
                      border: `1px solid ${planData.color}20`,
                    }}
                    data-testid="button-contact-sales"
                  >
                    <Building2 className="h-4 w-4" />
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
                        disabled={isUpdating || !institution.trim()}
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
                        {isUpdating ? "Processing..." : "Activate Student Plan"}
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
        {showCheckout && checkoutPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => checkoutStep === "form" && setShowCheckout(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card rounded-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              data-testid="modal-checkout"
            >
              {checkoutStep === "form" && (
                <div className="p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-6 w-6 text-primary" />
                      <h3 className="font-display font-bold text-xl text-white uppercase tracking-wider">Checkout</h3>
                    </div>
                    <button onClick={() => setShowCheckout(false)} className="text-muted-foreground hover:text-white" data-testid="button-close-checkout">
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex justify-between items-center">
                    <div>
                      <p className="font-display font-bold text-white">{SUBSCRIPTION_PLANS[checkoutPlan].label}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-1">Billed {SUBSCRIPTION_PLANS[checkoutPlan].period}ly</p>
                    </div>
                    <p className="text-2xl font-display font-black text-white">${SUBSCRIPTION_PLANS[checkoutPlan].price}<span className="text-sm text-muted-foreground">/{SUBSCRIPTION_PLANS[checkoutPlan].period}</span></p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest block mb-2">Card Number</label>
                      <input
                        data-testid="input-card-number"
                        type="text"
                        placeholder="4242 4242 4242 4242"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-primary/50 transition-colors"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest block mb-2">Expiry</label>
                        <input
                          data-testid="input-card-expiry"
                          type="text"
                          placeholder="12/28"
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-primary/50 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest block mb-2">CVC</label>
                        <input
                          data-testid="input-card-cvc"
                          type="text"
                          placeholder="123"
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-primary/50 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckoutSubmit}
                    className="w-full py-4 rounded-xl font-mono text-sm uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                    data-testid="button-pay"
                  >
                    <Lock className="h-4 w-4" />
                    Pay ${SUBSCRIPTION_PLANS[checkoutPlan].price}
                  </button>

                  <p className="text-center text-[10px] text-muted-foreground font-mono flex items-center justify-center gap-1">
                    <Lock className="h-3 w-3" /> Secured by Stripe
                  </p>
                </div>
              )}

              {checkoutStep === "processing" && (
                <div className="p-12 flex flex-col items-center justify-center space-y-4">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-2 border-primary/20 rounded-full" />
                    <div className="absolute inset-0 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                  <p className="font-display font-bold text-white text-lg uppercase tracking-widest">Processing Payment</p>
                  <p className="text-xs font-mono text-muted-foreground">Securing your subscription...</p>
                </div>
              )}

              {checkoutStep === "complete" && (
                <div className="p-12 flex flex-col items-center justify-center space-y-4">
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
