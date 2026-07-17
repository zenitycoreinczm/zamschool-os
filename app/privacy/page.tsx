import type { Metadata } from "next";

import LegalPageLayout, {
  LegalLink,
  LegalMail,
} from "@/components/landing/LegalPageLayout";

export const metadata: Metadata = {
  title: "Privacy Policy | ZamSchool OS",
  description:
    "How ZenityCore collects, uses, and protects school and personal data in ZamSchool OS.",
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      current="privacy"
      title="Privacy Policy"
      summary="This policy explains what information ZamSchool OS handles, why we handle it, who can see it, and how you can ask questions or request changes. We wrote it in plain language so schools, staff, and families can understand it."
      lastUpdated="16 July 2026"
      sections={[
        {
          id: "who-we-are",
          title: "Who we are",
          body: (
            <>
              <p>
                ZamSchool OS is a school management platform provided by{" "}
                <strong className="font-semibold text-slate-800">ZenityCore</strong>
                . In this policy, “we,” “us,” and “our” mean ZenityCore. “You”
                means a school, staff member, parent, guardian, student, or any
                other authorized person using the platform.
              </p>
              <p>
                Contact: <LegalMail>zenitycoreinc@gmail.com</LegalMail>
              </p>
            </>
          ),
        },
        {
          id: "our-commitment",
          title: "Our commitment",
          body: (
            <>
              <p>
                Schools use ZamSchool OS for sensitive work: student records,
                family contacts, attendance, results, messages, fees, and staff
                accounts. We treat that as confidential school data.
              </p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>We do not sell school or student data.</li>
                <li>
                  We do not use student records for advertising or marketing
                  profiles.
                </li>
                <li>
                  We use data to run the product, keep it secure, support
                  schools, and meet legal duties.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "what-we-collect",
          title: "What we collect",
          body: (
            <>
              <p>
                What appears in ZamSchool OS depends on what each school enters
                and which features it uses. That can include:
              </p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  Account details: name, email, phone, role, password (stored
                  securely), and school affiliation
                </li>
                <li>
                  School records: classes, subjects, student profiles, parent
                  links, staff profiles, attendance, results, announcements,
                  messages, fee records, and uploaded files
                </li>
                <li>
                  Technical data: device and browser type, IP address, login
                  sessions, error logs, security events, and basic usage needed
                  to keep the service reliable
                </li>
              </ul>
              <p>
                We do not ask for more personal data than the product needs to
                work. Schools decide most of what is stored about their
                community.
              </p>
            </>
          ),
        },
        {
          id: "how-we-use-it",
          title: "How we use information",
          body: (
            <>
              <p>We use information to:</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Create accounts, verify users, and apply role permissions</li>
                <li>
                  Power school workflows (enrolment, attendance, results,
                  messaging, fees where enabled)
                </li>
                <li>Provide support and fix problems</li>
                <li>
                  Protect the platform (security monitoring, audit logs, abuse
                  prevention)
                </li>
                <li>Maintain backups and improve reliability and performance</li>
                <li>Meet legal or regulatory requirements when they apply</li>
              </ul>
            </>
          ),
        },
        {
          id: "who-controls-records",
          title: "Who controls school records",
          body: (
            <>
              <p>
                <strong className="font-semibold text-slate-800">
                  Your school controls most day-to-day records.
                </strong>{" "}
                School administrators invite users, assign roles, enter student
                and staff data, and decide what stays in the system.
              </p>
              <p>
                Access is role-based. For example, teachers see teaching
                information they are allowed to see; parents see information
                linked to their children; students see their own school
                information.
              </p>
              <p>
                If a parent or student believes a record is wrong or should not
                be there, they should contact the school first. ZenityCore can
                help the school with technical support, export, correction, or
                deletion requests when appropriate.
              </p>
            </>
          ),
        },
        {
          id: "sharing",
          title: "When we share information",
          body: (
            <>
              <p>We share information only when needed to:</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Operate ZamSchool OS (hosting, database, authentication, storage, email)</li>
                <li>Provide support at a school’s request</li>
                <li>Comply with law, court order, or lawful request</li>
                <li>
                  Protect the safety, security, or rights of users, schools, or
                  ZenityCore
                </li>
              </ul>
              <p>
                Trusted service providers process data only to provide services
                to us. They are not permitted to use school data for their own
                marketing.
              </p>
              <p>
                If ZenityCore is involved in a merger, acquisition, or sale of
                assets, school data may transfer as part of that deal. We will
                take reasonable steps so it remains protected under this policy
                or an equivalent one.
              </p>
            </>
          ),
        },
        {
          id: "security",
          title: "Security",
          body: (
            <>
              <p>
                We use technical and operational safeguards such as
                authentication, access controls, session protection, secure
                hosting, and logging. No online service is perfectly secure.
              </p>
              <p>
                Schools and users should use strong passwords, keep credentials
                private, and report suspected unauthorized access quickly to the
                school and to us at{" "}
                <LegalMail>zenitycoreinc@gmail.com</LegalMail>.
              </p>
            </>
          ),
        },
        {
          id: "retention",
          title: "How long we keep data",
          body: (
            <>
              <p>
                We keep information while a school uses ZamSchool OS and for a
                reasonable period afterward for backups, support, security,
                dispute resolution, and legal obligations.
              </p>
              <p>
                When data is no longer needed, we delete or anonymize it where
                practical. Some copies may remain for a limited time in backups
                or audit logs. Schools can contact us about closure, export, or
                deletion.
              </p>
            </>
          ),
        },
        {
          id: "international",
          title: "Where data is processed",
          body: (
            <>
              <p>
                We use infrastructure providers that may store or process data
                outside the country where a school is based. When that happens,
                we rely on reasonable technical and contractual protections.
              </p>
            </>
          ),
        },
        {
          id: "children",
          title: "Children and student data",
          body: (
            <>
              <p>
                ZamSchool OS is built for schools and often includes information
                about students, including children. That information should only
                be entered for legitimate educational and school administration
                purposes by authorized users.
              </p>
              <p>
                We do not knowingly use student data for advertising. Student
                records are for school operations inside the platform.
              </p>
            </>
          ),
        },
        {
          id: "your-choices",
          title: "Your choices and requests",
          body: (
            <>
              <p>
                You can update some profile details in the app. Requests about
                student records, results, or parent links usually go through the
                school first.
              </p>
              <p>
                You can also email us at{" "}
                <LegalMail>zenitycoreinc@gmail.com</LegalMail> with privacy
                questions or requests. We may need to verify who you are and
                confirm school authorization before making changes.
              </p>
            </>
          ),
        },
        {
          id: "cookies",
          title: "Cookies and similar tools",
          body: (
            <>
              <p>
                We use cookies and browser storage mainly so you can sign in,
                stay signed in securely, and use the product. Details are in our{" "}
                <LegalLink href="/cookies">Cookie Policy</LegalLink>.
              </p>
            </>
          ),
        },
        {
          id: "changes",
          title: "Changes to this policy",
          body: (
            <>
              <p>
                We may update this page when the product or the law changes. The
                “Last updated” date at the top will change when we do. Continued
                use of ZamSchool OS after an update means the revised policy
                applies.
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
                Privacy or data questions:{" "}
                <LegalMail>zenitycoreinc@gmail.com</LegalMail>
              </p>
              <p>
                Please include your school name, your role, and a clear
                description of the request so we can respond properly.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
