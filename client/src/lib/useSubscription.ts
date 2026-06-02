import { useAuth } from "./useAuth";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@shared/schema";

export function useSubscription() {
  const { user } = useAuth();

  const plan = (user?.subscriptionPlan || "INDIVIDUAL_FREE") as SubscriptionPlan;
  const planData = SUBSCRIPTION_PLANS[plan] || SUBSCRIPTION_PLANS.INDIVIDUAL_FREE;
  const limits = planData.limits;

  return {
    plan,
    planData,
    limits,
    canAccessPathways: limits.pathwaysAccess,
    canAccessEnterprise: limits.enterpriseAccess,
    canAccessReport: limits.reportAccess,
    canAccessForgeCards: limits.forgeCards,
    canAccessTraining: (limits as any).trainingProviderAccess === true,
    hasUnlimitedUploads: limits.uploadsPerMonth === -1,
  };
}
