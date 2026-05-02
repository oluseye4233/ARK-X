import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import { SUBSCRIPTION_PLANS, CONTEXT_CRAFT_LEVELS, type SubscriptionPlan, type ContextCraftLevel, type UserCredits } from "@shared/schema";
import { GuinProfileView } from "./guin-public";
import {
  User,
  Mail,
  Briefcase,
  Building2,
  MapPin,
  Crown,
  ShieldCheck,
  CreditCard,
  Save,
  CheckCircle2,
  GraduationCap,
  Award,
  Coins,
  ShoppingBag,
} from "lucide-react";
import { Link } from "wouter";

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || "",
    role: user?.role || "",
    department: user?.department || "",
    location: user?.location || "",
    seniority: user?.seniority || "",
  });

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto min-h-[60vh] flex flex-col items-center justify-center">
        <p className="font-mono text-sm text-muted-foreground uppercase">Please log in to view your profile.</p>
      </div>
    );
  }

  const plan = SUBSCRIPTION_PLANS[(user.subscriptionPlan || "INDIVIDUAL_FREE") as SubscriptionPlan];
  const cert = CONTEXT_CRAFT_LEVELS[(user.contextCraftCertLevel || "NONE") as ContextCraftLevel];

  const [saveError, setSaveError] = useState<string | null>(null);
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [sales, setSales] = useState<{ totalEarned: number; salesCount: number } | null>(null);
  const [guin, setGuin] = useState<any>(null);

  const loadGuin = () => {
    api.getGuinById(user.id).then(setGuin).catch(() => setGuin(null));
  };

  useEffect(() => {
    api.getCredits(user.id).then(setCredits).catch(() => null);
    api.getSpcSales(user.id).then(setSales).catch(() => null);
    loadGuin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const handleSave = async () => {
    setSaveError(null);
    try {
      await api.updateProfile(user.id, form);
      updateUser(form);
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save profile. Please try again.");
    }
  };

  const fields = [
    { key: "name", label: "Full Name", icon: User, value: form.name },
    { key: "role", label: "Role / Title", icon: Briefcase, value: form.role },
    { key: "department", label: "Department", icon: Building2, value: form.department },
    { key: "seniority", label: "Seniority Level", icon: Award, value: form.seniority },
    { key: "location", label: "Location", icon: MapPin, value: form.location },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary tracking-widest uppercase" data-testid="text-profile-title">
            User Profile
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-2">
            ACCOUNT CONFIGURATION // {user.username}
          </p>
        </div>
        <Link href={`/u/${user.username}`} data-testid="link-view-public-profile">
          <a className="px-3 py-1.5 rounded-lg font-mono text-[11px] uppercase tracking-wider border border-purple-300/30 bg-purple-300/10 text-purple-200 hover:bg-purple-300/20 transition-colors">
            View Public Profile →
          </a>
        </Link>
      </div>

      {saveError && (
        <div className="glass-card p-4 rounded-xl border border-destructive/30 bg-destructive/5 flex items-center gap-3">
          <span className="font-mono text-sm text-destructive">{saveError}</span>
        </div>
      )}

      {saved && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 rounded-xl border border-secondary/30 bg-secondary/5 flex items-center gap-3"
        >
          <CheckCircle2 className="h-5 w-5 text-secondary flex-shrink-0" />
          <span className="font-mono text-sm text-secondary">Profile updated successfully.</span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 rounded-xl" data-testid="card-profile-details">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-bold text-lg text-white uppercase tracking-wider">Profile Details</h2>
              <button
                onClick={() => editing ? handleSave() : setEditing(true)}
                data-testid="button-edit-profile"
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider transition-all hover:scale-[1.02]"
                style={{
                  color: editing ? "#44AA44" : "hsl(var(--primary))",
                  backgroundColor: editing ? "rgba(68,170,68,0.1)" : "hsl(var(--primary) / 0.1)",
                  border: `1px solid ${editing ? "rgba(68,170,68,0.3)" : "hsl(var(--primary) / 0.3)"}`,
                }}
              >
                {editing ? <Save className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                {editing ? "Save Changes" : "Edit Profile"}
              </button>
            </div>

            <div className="space-y-4">
              {fields.map(({ key, label, icon: Icon, value }) => (
                <div key={key} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest block mb-1">{label}</label>
                    {editing ? (
                      <input
                        data-testid={`input-profile-${key}`}
                        type="text"
                        value={value}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary/50 transition-colors"
                      />
                    ) : (
                      <p className="text-white font-mono text-sm" data-testid={`text-profile-${key}`}>
                        {value || "—"}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest block mb-1">Email</label>
                  <p className="text-white font-mono text-sm" data-testid="text-profile-email">{user.username}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Link href="/subscription" className="block" data-testid="link-profile-subscription">
            <div className="glass-card p-5 rounded-xl hover:border-primary/30 transition-all hover:scale-[1.02] cursor-pointer border border-transparent">
              <div className="flex items-center gap-3 mb-3">
                <CreditCard className="h-5 w-5" style={{ color: plan.color }} />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Subscription</span>
              </div>
              <p className="font-display font-bold text-lg text-white">{plan.label}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {plan.price === 0 ? (plan.key === "ENTERPRISE" ? "Custom" : "Free") : `$${plan.price}/${plan.period}`}
              </p>
              <div className="mt-3 px-2 py-1 rounded text-[10px] font-mono font-bold uppercase inline-block" style={{ color: plan.color, backgroundColor: `${plan.color}15`, border: `1px solid ${plan.color}30` }}>
                ACTIVE
              </div>
            </div>
          </Link>

          <Link href="/context-craft" className="block" data-testid="link-profile-cert">
            <div className="glass-card p-5 rounded-xl hover:border-primary/30 transition-all hover:scale-[1.02] cursor-pointer border border-transparent">
              <div className="flex items-center gap-3 mb-3">
                <ShieldCheck className="h-5 w-5" style={{ color: cert.color }} />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Context Craft</span>
              </div>
              <p className="font-display font-bold text-lg text-white">{cert.label}</p>
              <p className="text-sm text-muted-foreground mt-1">{cert.multiplier}x JST Multiplier</p>
            </div>
          </Link>

          {user.institution && (
            <div className="glass-card p-5 rounded-xl border border-transparent">
              <div className="flex items-center gap-3 mb-3">
                <GraduationCap className="h-5 w-5 text-purple-400" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Institution</span>
              </div>
              <p className="font-display font-bold text-lg text-white">{user.institution}</p>
            </div>
          )}

          <Link href="/marketplace" className="block" data-testid="link-profile-marketplace">
            <div className="glass-card p-5 rounded-xl hover:border-primary/30 transition-all hover:scale-[1.02] cursor-pointer border border-transparent space-y-3">
              <div className="flex items-center gap-3">
                <ShoppingBag className="h-5 w-5 text-primary" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">SPHINX Marketplace</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground">Credits</div>
                  <div className="flex items-center gap-1.5">
                    <Coins className="h-4 w-4 text-amber-400" />
                    <span className="font-display font-bold text-xl text-amber-400" data-testid="text-profile-credits">
                      {credits ? credits.balance : "—"}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground">Earned</div>
                  <div className="font-display font-bold text-xl text-secondary" data-testid="text-profile-earned">
                    {sales ? sales.totalEarned : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground">Sales</div>
                  <div className="font-display font-bold text-xl text-white" data-testid="text-profile-sales">
                    {sales ? sales.salesCount : "—"}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {guin && (
        <div className="pt-4 border-t border-white/5">
          <GuinProfileView profile={guin} viewerCanEndorse={false} onEndorse={loadGuin} />
        </div>
      )}
    </div>
  );
}
