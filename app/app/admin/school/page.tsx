"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminApiJson } from "@/lib/admin-browser-api";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { SchoolDayHoursPanel } from "@/components/admin/SchoolDayHoursPanel";
import { Surface } from "@/components/workspace/Surface";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import { normalizeRole } from "@/lib/roles";

type SchoolRecord = {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  status?: string | null;
};

type FormState = {
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  accessCode: string;
  emisCode: string;
  province: string;
  district: string;
  schoolType: string;
  ownershipType: string;
  logoUrl: string;
};

type SetupUser = {
  id: string;
  email?: string | null;
  emailConfirmed: boolean;
  headTeacherName?: string | null;
};

const DEFAULT_FORM: FormState = {
  name: "",
  code: "",
  address: "",
  phone: "",
  email: "",
  accessCode: "",
  emisCode: "",
  province: "",
  district: "",
  schoolType: "",
  ownershipType: "",
  logoUrl: "",
};

// These are optional and may not exist in every current schema version.
const OPTIONAL_SCHOOL_COLUMNS = [
  "emis_code",
  "province",
  "district",
  "school_type",
  "ownership_type",
] as const;

export default function AdminSchoolPage() {
  const { role: workspaceRole } = useWorkspaceContext();
  const actorRole = normalizeRole(workspaceRole);
  const canEditSchoolProfile =
    actorRole === "PRINCIPAL" || actorRole === "SUPER_ADMIN";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [setupUser, setSetupUser] = useState<SetupUser | null>(null);
  const [availableColumns, setAvailableColumns] = useState<Set<string>>(
    new Set(),
  );
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const isCreatingSchool = !schoolId;
  const canSave = useMemo(() => {
    if (!canEditSchoolProfile) return false;
    const hasCoreFields =
      form.name.trim().length >= 2 && form.code.trim().length >= 4;
    return isCreatingSchool
      ? hasCoreFields && /^\d{6}$/.test(form.accessCode.trim())
      : hasCoreFields;
  }, [
    form.name,
    form.code,
    form.accessCode,
    isCreatingSchool,
    canEditSchoolProfile,
  ]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const body = await adminApiJson<{
          data?: {
            profile?: {
              id?: string;
              email?: string | null;
              school_id?: string | null;
            };
            school?: (SchoolRecord & Record<string, any>) | null;
            auth?: SetupUser;
          };
        }>("/api/admin/school");
        const profile = body.data?.profile;
        const school = body.data?.school;
        const auth = body.data?.auth || null;
        setProfileId(profile?.id || null);
        setSetupUser(auth);

        if (!school) {
          setSchoolId(null);
          setAvailableColumns(
            new Set([
              "name",
              "code",
              "phone",
              "email",
              "address",
              "logo_url",
              ...OPTIONAL_SCHOOL_COLUMNS,
            ]),
          );
          setForm((prev) => ({
            ...prev,
            email: profile?.email || auth?.email || "",
          }));
          return;
        }

        const row = school as SchoolRecord & Record<string, any>;

        setSchoolId(row.id);
        setForm({
          name: row.name || "",
          code: row.code || "",
          address: row.address || "",
          phone: row.phone || "",
          email: row.email || "",
          accessCode: "",
          emisCode: row.emis_code || "",
          province: row.province || "",
          district: row.district || "",
          schoolType: row.school_type || "",
          ownershipType: row.ownership_type || "",
          logoUrl: row.logo_url || "",
        });

        setAvailableColumns(new Set(Object.keys(row || {})));
      } catch (err: any) {
        toast.error(err?.message || "Failed to load school profile");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const onChange = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = async () => {
    if (!canEditSchoolProfile) {
      toast.error("Only the Head Teacher can update school profile details.");
      return;
    }
    if (!canSave) {
      toast.error("School name and school code are required");
      return;
    }

    setSaving(true);
    const loadingToast = toast.loading("Saving school profile...");

    try {
      const payload: Record<string, any> = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        logo_url: form.logoUrl.trim() || null,
      };

      // Only send optional fields if the columns exist in the live table.
      if (availableColumns.has("emis_code"))
        payload.emis_code = form.emisCode.trim() || null;
      if (availableColumns.has("province"))
        payload.province = form.province.trim() || null;
      if (availableColumns.has("district"))
        payload.district = form.district.trim() || null;
      if (availableColumns.has("school_type"))
        payload.school_type = form.schoolType.trim() || null;
      if (availableColumns.has("ownership_type"))
        payload.ownership_type = form.ownershipType.trim() || null;

      if (!schoolId) {
        const email = form.email.trim() || setupUser?.email || "";
        if (!setupUser?.id && !profileId) throw new Error("No active session");
        if (!setupUser?.emailConfirmed)
          throw new Error("Verify your email before creating a school");
        if (!/^\d{6}$/.test(form.accessCode.trim()))
          throw new Error("Enter a valid 6-digit access code");
        const headTeacherName = String(
          setupUser?.headTeacherName || email.split("@")[0] || "Head Teacher",
        );

        await adminApiJson("/api/auth/register-school", {
          method: "POST",
          body: JSON.stringify({
            email,
            schoolName: form.name.trim(),
            schoolCode: form.code.trim().toUpperCase(),
            headTeacherName,
            phone: form.phone.trim(),
            address: form.address.trim(),
            logoUrl: form.logoUrl.trim(),
            emisCode: form.emisCode.trim(),
            province: form.province.trim(),
            district: form.district.trim(),
            schoolType: form.schoolType.trim(),
            ownershipType: form.ownershipType.trim(),
            accessCode: form.accessCode.trim(),
          }),
        });

        const createdBody = await adminApiJson<{
          data?: { school?: SchoolRecord & Record<string, any> };
        }>("/api/admin/school");
        const createdSchool = createdBody.data?.school;
        if (!createdSchool)
          throw new Error("School profile was created but could not be loaded");

        setSchoolId(createdSchool.id);
        setAvailableColumns(new Set(Object.keys(createdSchool || {})));
        toast.success("School profile created", { id: loadingToast });
      } else {
        const body = await adminApiJson<{
          data?: SchoolRecord & Record<string, any>;
        }>("/api/admin/school", {
          method: "PUT",
          body: JSON.stringify({
            name: payload.name,
            code: payload.code,
            address: payload.address,
            phone: payload.phone,
            email: payload.email,
            logoUrl: payload.logo_url,
            emisCode: payload.emis_code,
            province: payload.province,
            district: payload.district,
            schoolType: payload.school_type,
            ownershipType: payload.ownership_type,
          }),
        });
        if (body.data) {
          setAvailableColumns(new Set(Object.keys(body.data || {})));
        }
        toast.success("School profile updated", { id: loadingToast });
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save school profile", {
        id: loadingToast,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Surface
        variant="default"
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-3 p-10 text-sm text-slate-500"
        as="div"
      >
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        <p>Loading school profile...</p>
      </Surface>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">School Profile</h1>
        <p className="text-slate-500 mt-1">
          {canEditSchoolProfile
            ? "Update core school identity and contact details."
            : "School identity is managed by the Head Teacher. You can view details here."}
        </p>
      </div>

      {!canEditSchoolProfile ? (
        <Surface
          variant="default"
          className="border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"
          as="div"
        >
          Only the Head Teacher can change school profile data.
          {actorRole === "HR_ADMIN" ? (
            <>
              {" "}
              As HR, manage{" "}
              <Link
                href="/app/hr-admin/directory"
                className="font-semibold text-slate-900 underline-offset-2 hover:underline"
              >
                staff directory
              </Link>{" "}
              and{" "}
              <Link
                href="/app/admin/departments"
                className="font-semibold text-slate-900 underline-offset-2 hover:underline"
              >
                departments
              </Link>
              .
            </>
          ) : null}
        </Surface>
      ) : null}

      <Surface variant="default" className="space-y-5 p-5 md:p-6" as="div">
        <fieldset
          disabled={!canEditSchoolProfile}
          className="space-y-5 disabled:opacity-90"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <Field
              label="School name"
              value={form.name}
              onChange={(v) => onChange("name", v)}
              required
            />
            <Field
              label="School code"
              value={form.code}
              onChange={(v) =>
                onChange("code", v.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
              required
            />
            {isCreatingSchool ? (
              <Field
                label="Access code"
                value={form.accessCode}
                onChange={(v) =>
                  onChange("accessCode", v.replace(/\D/g, "").slice(0, 6))
                }
                required
              />
            ) : null}
            <Field
              label="Phone"
              value={form.phone}
              onChange={(v) => onChange("phone", v)}
            />
            <Field
              label="Email"
              value={form.email}
              onChange={(v) => onChange("email", v)}
            />
            <Field
              label="Address"
              value={form.address}
              onChange={(v) => onChange("address", v)}
              className="md:col-span-2"
            />
            <Field
              label="Logo URL"
              value={form.logoUrl}
              onChange={(v) => onChange("logoUrl", v)}
              className="md:col-span-2"
            />
          </div>

          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
              Extended fields
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <Field
                label="EMIS code"
                value={form.emisCode}
                onChange={(v) => onChange("emisCode", v)}
              />
              <Field
                label="Province"
                value={form.province}
                onChange={(v) => onChange("province", v)}
              />
              <Field
                label="District"
                value={form.district}
                onChange={(v) => onChange("district", v)}
              />
              <Field
                label="School type"
                value={form.schoolType}
                onChange={(v) => onChange("schoolType", v)}
              />
              <Field
                label="Ownership type"
                value={form.ownershipType}
                onChange={(v) => onChange("ownershipType", v)}
              />
            </div>

            {OPTIONAL_SCHOOL_COLUMNS.some((c) => !availableColumns.has(c)) ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-4">
                Some extended fields are not available in the current database
                schema and will be ignored on save.
              </p>
            ) : null}
          </div>
        </fieldset>

        {canEditSchoolProfile ? (
          <div className="pt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !canSave}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isCreatingSchool ? "Create school" : "Save changes"}
            </button>
          </div>
        ) : null}
      </Surface>

      <SchoolDayHoursPanel
        canEdit={canEditSchoolProfile}
        schoolReady={Boolean(schoolId)}
      />

      <Surface variant="default" className="p-5" as="div">
        <p className="font-semibold text-slate-800">School identity</p>
        <p className="mt-1 text-sm text-slate-500">
          These details appear across admin workspace, communication templates,
          and reports.
        </p>
      </Surface>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-required={required || undefined}
        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300"
      />
    </label>
  );
}
