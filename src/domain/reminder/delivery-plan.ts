export type DeliveryMode = "email" | "web_push" | "web_push_email_fallback";

export type DeliveryTarget =
  | { readonly channel: "email" }
  | { readonly channel: "web_push"; readonly subscriptionId: string };

export interface DeliveryPlan {
  readonly mode: DeliveryMode;
  readonly targets: readonly DeliveryTarget[];
}

export function createDeliveryPlan(
  mode: DeliveryMode,
  pushSubscriptionId?: string,
): DeliveryPlan {
  if (mode === "email") {
    return { mode, targets: [{ channel: "email" }] };
  }
  if (pushSubscriptionId === undefined || pushSubscriptionId === "") {
    throw new Error("PUSH_SUBSCRIPTION_REQUIRED");
  }
  const pushTarget = {
    channel: "web_push" as const,
    subscriptionId: pushSubscriptionId,
  };
  return mode === "web_push"
    ? { mode, targets: [pushTarget] }
    : { mode, targets: [pushTarget, { channel: "email" }] };
}

export function includesEmail(plan: DeliveryPlan): boolean {
  return plan.targets.some((target) => target.channel === "email");
}
