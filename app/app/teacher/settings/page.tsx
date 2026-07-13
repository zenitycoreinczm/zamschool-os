"use client";

import { Eye } from "lucide-react";
import { useTeacherWorkspacePreferences } from "@/lib/teacher-workspace-preferences";
import { AccountSettingsPage } from "@/components/account/AccountSettingsPage";
import { Surface } from "@/components/workspace/Surface";

export default function TeacherSettingsPage() {
  const { preferences, updatePreferences } = useTeacherWorkspacePreferences();

  return (
    <AccountSettingsPage
      pageTitle="Account settings"
      intro="Manage your account, notifications, password, and two-factor authentication for teaching."
      accent="slate"
      preferencesStorageKey="teacher-workspace-settings"
      sessionTitle="Your account"
      sessionBody="Email, role, and school for the signed-in account."
      eyebrow="Teacher workspace"
    >
      <Surface variant="default" className="p-5" as="div">
        <h2 className="text-sm font-semibold text-slate-700">Appearance</h2>
        <div className="mt-4 space-y-3">
          <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 transition hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Compact cards
                </p>
                <p className="text-xs text-slate-500">
                  Use a denser layout for sidebar cards
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={preferences.compactCards}
              onChange={(e) =>
                updatePreferences({ compactCards: e.target.checked })
              }
              className="h-5 w-5 rounded border-slate-300 text-amber-500 focus:ring-2 focus:ring-amber-200"
            />
          </label>
        </div>
      </Surface>
    </AccountSettingsPage>
  );
}
