import type { Metadata } from "next";

import LegalPageLayout, {
  LegalLink,
  LegalMail,
} from "@/components/landing/LegalPageLayout";

export const metadata: Metadata = {
  title: "Cookie Policy | ZamSchool OS",
  description:
    "How ZamSchool OS uses cookies and browser storage for login, security, and basic product function.",
};

export default function CookiesPage() {
  return (
    <LegalPageLayout
      current="cookies"
      title="Cookie Policy"
      summary="This page explains how ZamSchool OS uses cookies and similar browser storage. We keep this simple: these tools mainly keep you signed in securely and make the product work. We do not use them to sell school data or build advertising profiles."
      lastUpdated="16 July 2026"
      sections={[
        {
          id: "scope",
          title: "Who this applies to",
          body: (
            <>
              <p>
                This policy applies to anyone who uses ZamSchool OS in a browser
                or supported device: school staff, parents, guardians, students,
                and administrators.
              </p>
              <p>
                “We” means ZenityCore, the company that provides ZamSchool OS.
              </p>
            </>
          ),
        },
        {
          id: "what-are-cookies",
          title: "What cookies and storage are",
          body: (
            <>
              <p>
                Cookies are small pieces of data a browser stores for a website.
                Similar tools (local storage and session storage) can also hold
                limited information so the app works between page loads.
              </p>
              <p>
                In ZamSchool OS, we use these mainly for security and core
                function, not for advertising.
              </p>
            </>
          ),
        },
        {
          id: "what-we-use",
          title: "What we use them for",
          body: (
            <>
              <p>
                <strong className="font-semibold text-slate-800">
                  Essential (required for the product)
                </strong>
              </p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Signing in and staying signed in</li>
                <li>Protecting sessions and reducing unauthorized access</li>
                <li>Routing you to the correct school workspace and role</li>
                <li>Basic security and abuse prevention</li>
              </ul>
              <p className="mt-3">
                Without these, login and many school features will not work
                reliably.
              </p>
              <p className="mt-4">
                <strong className="font-semibold text-slate-800">
                  Preferences and product function
                </strong>
              </p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Remembering simple UI or workspace settings</li>
                <li>
                  Supporting offline-ready or continuity features where enabled
                </li>
              </ul>
              <p className="mt-4">
                <strong className="font-semibold text-slate-800">
                  Performance and diagnostics
                </strong>
              </p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  Limited technical signals (errors, performance, uptime) so we
                  can fix issues and keep the service stable
                </li>
              </ul>
              <p className="mt-3">
                Diagnostic use is for running and improving ZamSchool OS, not for
                selling data or unrelated ads. More on data handling is in our{" "}
                <LegalLink href="/privacy">Privacy Policy</LegalLink>.
              </p>
            </>
          ),
        },
        {
          id: "what-we-dont",
          title: "What we do not use them for",
          body: (
            <>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Selling school or student data</li>
                <li>
                  Building advertising profiles from student or family records
                </li>
                <li>
                  Letting third parties use confidential school information for
                  their own marketing
                </li>
              </ul>
              <p>
                ZamSchool OS is a school operations product, not an advertising
                network.
              </p>
            </>
          ),
        },
        {
          id: "third-parties",
          title: "Third-party technology",
          body: (
            <>
              <p>
                Some cookies or storage may come from trusted providers that
                support hosting, authentication, security, analytics, email, or
                payments (where enabled). They process only what is needed for
                those services and have their own policies.
              </p>
            </>
          ),
        },
        {
          id: "manage",
          title: "How to manage cookies",
          body: (
            <>
              <p>
                You can usually block, delete, or review cookies in your browser
                settings, and clear site data when you want.
              </p>
              <p>
                If you block essential cookies, you may be signed out often, lose
                preferences, or be unable to use important parts of ZamSchool OS.
              </p>
            </>
          ),
        },
        {
          id: "school-devices",
          title: "School-managed devices",
          body: (
            <>
              <p>
                School IT policies, firewalls, or locked-down browsers can affect
                cookies and storage. If login does not stick or the app behaves
                oddly on a school device, the school’s IT administrator may need
                to allow required cookies for ZamSchool OS.
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
                We may update this page if how we use cookies or storage changes.
                The “Last updated” date at the top will reflect the latest
                version.
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
                Cookie or browser-storage questions:{" "}
                <LegalMail>zenitycoreinc@gmail.com</LegalMail>
              </p>
              <p>
                Include your school name, browser, and a short description of the
                issue.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
