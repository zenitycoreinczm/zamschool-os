import { Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { primaryButton, secondaryButton } from "@/lib/workspace/design";
import { UsersModalShell } from "./UsersModalShell";
import type { NewCredentials } from "./types";

type NewCredentialsModalProps = {
  credentials: NewCredentials;
  onClose: () => void;
};

export function NewCredentialsModal({
  credentials,
  onClose,
}: NewCredentialsModalProps) {
  return (
    <UsersModalShell
      size="xl"
      title="New account credentials"
      description={
        credentials.emailSent
          ? "Sign-in details were emailed when SMTP is configured. You can also copy them below."
          : "Save these credentials and share them securely with the user."
      }
      onClose={onClose}
      bodyClassName="space-y-4"
      footer={
        <>
          <button
            type="button"
            onClick={async () => {
              const text = `Email: ${credentials.email}\nTemporary Password (one-time): ${credentials.password}\nThe user must change this password on first login.`;
              try {
                await navigator.clipboard.writeText(text);
                toast.success("Credentials copied");
              } catch {
                toast.error("Copy failed");
              }
            }}
            className={secondaryButton()}
          >
            <Copy className="h-4 w-4" aria-hidden />
            Copy
          </button>
          <button type="button" onClick={onClose} className={primaryButton()}>
            Done
          </button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-workspace-muted">
        They sign in at{" "}
        <span className="font-medium text-slate-800">/login</span> with this
        one-time temporary password, then must choose a new password on first
        login.
      </p>

      <div className="space-y-3 rounded-workspace-xl border border-amber-200/80 bg-amber-50/60 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-900/80">
          <KeyRound className="h-3.5 w-3.5" aria-hidden />
          One-time access
        </div>
        <div className="text-sm">
          <span className="text-workspace-muted">Email: </span>
          <span className="font-medium text-slate-800 break-all">
            {credentials.email}
          </span>
        </div>
        <div className="text-sm">
          <span className="text-workspace-muted">Temporary password: </span>
          <span
            className={cn(
              "inline-block rounded-lg bg-white px-2 py-1 font-mono text-sm font-semibold tracking-wide text-slate-900 ring-1 ring-amber-200/80",
            )}
          >
            {credentials.password}
          </span>
        </div>
      </div>
    </UsersModalShell>
  );
}
