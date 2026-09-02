import { emailButton, wrapEmailHtml } from "@/lib/email-templates";
import { getAppOrigin } from "@/lib/app-origin";
import { getRoleDisplayLabel } from "@/lib/roles";
import { emailService } from "@/lib/email";
import { maskEmail } from "@/lib/logger";

export async function sendAccountCredentialsEmail(input: {
  to: string;
  firstName: string;
  role: string;
  temporaryPassword: string;
  acceptUrl?: string;
}) {
  console.log(
    `[sendAccountCredentialsEmail] Preparing email for ${maskEmail(input.to)} (role=${input.role})`,
  );
  const appOrigin = getAppOrigin();
  const loginUrl = `${appOrigin}/login`;
  const roleLabel = getRoleDisplayLabel(input.role);

  const text = [
    `Hello ${input.firstName},`,
    "",
    `Your ${roleLabel} account for ZamSchool OS is ready.`,
    "",
    `Sign-in email: ${input.to}`,
    `Temporary password: ${input.temporaryPassword}`,
    "",
    `Sign in: ${loginUrl}`,
    ...(input.acceptUrl ? [`Accept invitation: ${input.acceptUrl}`] : []),
    "",
    "You must change this password on first login before using your workspace.",
    "If you did not expect this message, contact your school office.",
  ].join("\n");

  const acceptParagraph = input.acceptUrl
    ? `<p style="margin-top:12px">Before signing in, you may need to accept your invitation first:</p>
       ${emailButton(input.acceptUrl, "Accept invitation")}`
    : "";

  const html = wrapEmailHtml(
    `
      <p>Hello ${input.firstName},</p>
      <p>Your school created a <strong>${roleLabel}</strong> account for you on ZamSchool OS.</p>
      <table style="margin:16px 0;border-collapse:collapse;width:100%">
        <tr><td style="padding:6px 12px 6px 0;color:#64748b">Email</td><td><strong>${input.to}</strong></td></tr>
        <tr><td style="padding:6px 12px 6px 0;color:#64748b">Temporary password</td><td><strong style="font-family:monospace">${input.temporaryPassword}</strong></td></tr>
      </table>
      ${emailButton(loginUrl, "Sign in")}
      ${acceptParagraph}
      <p style="color:#64748b;font-size:14px">Change this password on first login. Do not share it publicly.</p>
    `,
    "Your account is ready",
  );

  const direct = await emailService.sendEmail({
    to: input.to,
    subject: `Your ZamSchool ${roleLabel} account`,
    text,
    html,
  });

  if (!direct.success) {
    throw new Error(direct.error || "Failed to send account credentials email");
  }

  return direct;
}
