import { getDailyUsage } from "../daily-usage-limit";
import type { MessageSendQuota } from "./quota-types";

export type { MessageSendQuota } from "./quota-types";

export async function getMessageSendQuota(userId: string): Promise<MessageSendQuota> {
  const usage = await getDailyUsage(userId, "messages_send");
  return {
    limit: usage.limit,
    used: usage.current,
    remaining: usage.remaining,
    canSend: usage.remaining > 0,
    resetsAt: new Date(Date.now() + usage.retryAfterSec * 1000).toISOString(),
  };
}
