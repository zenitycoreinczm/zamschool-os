import type { Metadata } from "next";

import LegalPageLayout, {
  LegalLink,
  LegalMail,
} from "@/components/landing/LegalPageLayout";

export const metadata: Metadata = {
  title: "Terms of Service | ZamSchool OS",
  description:
    "Terms for using ZamSchool OS, the school management platform provided by ZenityCore.",
};

export default function TermsPage() {
  return (
    <LegalPageLayout
      current="terms"
      title="Terms of Service"
      summary="These terms set out how schools and users may use ZamSchool OS, what ZenityCore is responsible for, and what remains the school’s responsibility. By using the platform, you agree to them."
      lastUpdated="16 July 2026"
      sections={[
        {
          id: "about",
          title: "About ZamSchool OS",
          body: (
            <>
              <p>
                ZamSchool OS is software provided by{" "}
                <strong className="font-semibold text-slate-800">ZenityCore</strong>{" "}
                to help schools run administration, student records, teaching
                workflows, attendance, results, communication, and fees where
                enabled.
              </p>
              <p>
                “We,” “us,” and “our” mean ZenityCore. “You” means a school,
                organization, or any authorized user (staff, parent, guardian,
                student, or administrator).
              </p>
            </>
          ),
        },
        {
          id: "agreement",
          title: "Accepting these terms",
          body: (
            <>
              <p>
                By registering, signing in, accepting an invitation, or using
                ZamSchool OS, you agree to these terms and our{" "}
                <LegalLink href="/privacy">Privacy Policy</LegalLink>. If you do
                not agree, do not use the platform.
              </p>
              <p>
                If you act for a school, you confirm you are allowed to accept
                these terms for that school.
              </p>
            </>
          ),
        },
        {
          id: "access",
          title: "Access and accounts",
          body: (
            <>
              <p>
                Schools use ZamSchool OS under an arrangement with ZenityCore
                (subscription, pilot, or other agreement). Features may vary by
                school, role, or rollout stage.
              </p>
              <p>
                Schools are responsible for inviting the right people, assigning
                correct roles, keeping records accurate, and removing access when
                someone leaves or changes role.
              </p>
              <p>
                Users must keep login details private, use secure practices on
                shared devices, and report suspected unauthorized access to the
                school and to us.
              </p>
            </>
          ),
        },
        {
          id: "acceptable-use",
          title: "Acceptable use",
          body: (
            <>
              <p>
                Use ZamSchool OS only for legitimate school purposes and only
                within the permissions you have been given.
              </p>
              <p>You must not:</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Access another person’s account or data without authorization</li>
                <li>Bypass security or role restrictions</li>
                <li>
                  Misuse confidential school or student information
                </li>
                <li>
                  Upload harmful content, disrupt the service, scrape the
                  platform, or reverse engineer it without permission
                </li>
                <li>
                  Use the platform for unlawful activity, harassment, fraud, or
                  unauthorized marketing
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "school-data",
          title: "School data and ownership",
          body: (
            <>
              <p>
                <strong className="font-semibold text-slate-800">
                  The school owns its data.
                </strong>{" "}
                Records, messages, files, results, attendance, and fee
                information entered by authorized users remain the school’s
                responsibility. ZenityCore does not claim ownership of that
                content.
              </p>
              <p>
                By using the platform, the school and its users allow ZenityCore
                to host, process, display, back up, and support that content only
                as needed to run, secure, and improve ZamSchool OS.
              </p>
              <p>
                Enter only lawful, accurate information that is appropriate for a
                school setting. Sensitive data should be added only when there is
                a clear school purpose.
              </p>
            </>
          ),
        },
        {
          id: "sensitive-records",
          title: "Student, family, and staff records",
          body: (
            <>
              <p>
                Users must treat personal and educational information carefully
                and access it only for legitimate school work. Schools are
                responsible for meeting laws, policies, and consent duties that
                apply to student, family, and staff information.
              </p>
            </>
          ),
        },
        {
          id: "fees",
          title: "Fees and payments in the product",
          body: (
            <>
              <p>
                Where fee features are enabled, ZamSchool OS can help organize
                balances, receipts, and payment records. The school sets fees,
                confirms payments, handles refunds where applicable, and resolves
                billing questions with families.
              </p>
              <p>
                ZamSchool OS is not a bank or tax adviser. Third-party payment
                providers (if used) have their own terms and processes.
              </p>
            </>
          ),
        },
        {
          id: "service-changes",
          title: "Service changes and availability",
          body: (
            <>
              <p>
                We work to keep ZamSchool OS reliable, but no online service is
                available 100% of the time. Maintenance, network issues, or
                third-party outages may affect access.
              </p>
              <p>
                We may improve, change, or remove features when needed for
                security, quality, or product direction. We may suspend access
                for security risk, misuse, non-payment under a commercial
                agreement, or legal requirement.
              </p>
              <p>
                Schools should keep copies of critical records according to their
                own policies. We maintain backups for operational recovery, not
                as a school’s only archive.
              </p>
            </>
          ),
        },
        {
          id: "ip",
          title: "Intellectual property",
          body: (
            <>
              <p>
                ZamSchool OS software, design, branding, and documentation belong
                to ZenityCore or its licensors. Using the product does not
                transfer ownership of that intellectual property. You receive
                permission to use the platform for approved school purposes only.
              </p>
            </>
          ),
        },
        {
          id: "third-parties",
          title: "Third-party services",
          body: (
            <>
              <p>
                The platform may rely on providers for hosting, authentication,
                storage, email, analytics, or payments. Those services have their
                own terms. See also our{" "}
                <LegalLink href="/privacy">Privacy Policy</LegalLink> and{" "}
                <LegalLink href="/cookies">Cookie Policy</LegalLink>.
              </p>
            </>
          ),
        },
        {
          id: "liability",
          title: "Responsibility and liability",
          body: (
            <>
              <p>
                Schools remain responsible for their decisions, records, policies,
                communications, and the actions of their users. ZamSchool OS
                supports school operations; it does not replace professional
                judgment or legal duties of school leaders and staff.
              </p>
              <p>
                To the extent the law allows, ZenityCore is not liable for
                indirect losses, lost profits, or losses caused by user misuse,
                school policy failures, or decisions made using the platform.
                Nothing in these terms limits liability where the law forbids
                that limitation.
              </p>
            </>
          ),
        },
        {
          id: "changes",
          title: "Changes to these terms",
          body: (
            <>
              <p>
                We may update these terms when the product, law, or our business
                needs change. The “Last updated” date will change when we do.
                Continued use after that date means the revised terms apply.
              </p>
            </>
          ),
        },
        {
          id: "contact",
          title: "Contact",
          body: (
            <>
              <p>
                Questions about these terms:{" "}
                <LegalMail>zenitycoreinc@gmail.com</LegalMail>
              </p>
              <p>
                Include your school name, role, and the issue so we can respond
                clearly.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
