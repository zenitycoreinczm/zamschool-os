export type MessageSendQuota = {
  limit: number;
  used: number;
  remaining: number;
  canSend: boolean;
  resetsAt: string;
};
