import nodemailer from "nodemailer";
import { emailButton, wrapEmailHtml } from "@/lib/email-templates";

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;
  private configured = false;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    try {
      this.config = {
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "465", 10),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER || "",
          pass: process.env.SMTP_PASS || "",
        },
      };

      if (!this.config.auth.user || !this.config.auth.pass) {
        console.log(
          "[EmailService] SMTP not configured - SMTP_USER or SMTP_PASS missing",
        );
        return;
      }

      this.transporter = nodemailer.createTransport(this.config);
      this.configured = true;
      console.log(
        `[EmailService] SMTP configured - host=${this.config.host}:${this.config.port} user=${this.config.auth.user} from=${process.env.SMTP_FROM || this.config.auth.user}`,
      );
    } catch (error) {
      console.error("Failed to initialize email transporter:", error);
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async sendEmail(
    options: EmailOptions,
  ): Promise<{ success: boolean; error?: string; messageId?: string }> {
    if (!this.transporter || !this.config) {
      return { success: false, error: "Email service not configured" };
    }

    try {
      const fromAddress =
        options.from || process.env.SMTP_FROM || this.config.auth.user;
      console.log(
        `[EmailService] Sending email - to=${options.to} subject="${options.subject}" from=${fromAddress}`,
      );

      const result = await this.transporter.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to send email:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async sendOtpEmail(
    email: string,
    otpCode: string,
    userName?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const greeting = userName ? `Hello ${userName},` : "Hello,";
    const html = wrapEmailHtml(
      `
      <p>${greeting}</p>
      <p>Your verification code for ZamSchool OS is:</p>
      <p style="text-align:center;margin:24px 0">
        <span style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:6px;color:#0284c7;border:2px dashed #bae6fd;padding:16px 24px;border-radius:12px">${otpCode}</span>
      </p>
      <p style="color:#64748b;font-size:14px">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
    `,
      "Email verification",
    );

    const text = [
      "ZamSchool OS - Email Verification",
      "",
      greeting,
      "",
      `Your verification code is: ${otpCode}`,
      "",
      "This code expires in 10 minutes.",
    ].join("\n");

    return this.sendEmail({
      to: email,
      subject: "Your ZamSchool verification code",
      html,
      text,
    });
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      return { success: false, error: "Email service not configured" };
    }

    try {
      await this.transporter.verify();
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  }
}

export const emailService = new EmailService();
export default emailService;

export function buildStaffInviteEmail(input: {
  firstName: string;
  roleLabel: string;
  inviteUrl: string;
}) {
  const html = wrapEmailHtml(
    `
    <p>Hello ${input.firstName},</p>
    <p>You have been invited to join your school on ZamSchool OS as <strong>${input.roleLabel}</strong>.</p>
    ${emailButton(input.inviteUrl, "Accept invitation")}
    <p style="color:#64748b;font-size:14px">This link is personal. If you were not expecting this invitation, contact your school office.</p>
  `,
    "Staff invitation",
  );

  const text = [
    `Hello ${input.firstName},`,
    "",
    `You have been invited as ${input.roleLabel} on ZamSchool OS.`,
    `Accept your invitation: ${input.inviteUrl}`,
  ].join("\n");

  return { html, text };
}
