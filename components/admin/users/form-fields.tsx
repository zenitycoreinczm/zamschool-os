import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { primaryButton, secondaryButton } from "@/lib/workspace/design";
import type { ClassOption, FormNotice } from "./types";

const fieldControlClass =
  "w-full rounded-workspace-xl border border-workspace-border bg-white px-3 py-2 text-sm outline-none transition-shadow focus:ring-2 focus:ring-sky-200";

const fieldLabelClass = "mb-1 block text-xs font-medium text-slate-600";

export function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  hint,
  inputMode,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  hint?: string;
  inputMode?: "numeric" | "text" | "tel" | "email" | "search" | "url" | "decimal";
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className={fieldLabelClass}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-required={required || undefined}
        inputMode={inputMode}
        placeholder={placeholder}
        className={fieldControlClass}
      />
      {hint ? (
        <span className="mt-1 block text-[11px] leading-snug text-slate-400">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className={fieldLabelClass}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldControlClass}
      >
        {options.map((option) => (
          <option key={option || "__empty"} value={option}>
            {option || "—"}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SelectOptionField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ClassOption[];
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className={fieldLabelClass}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-required={required || undefined}
        className={fieldControlClass}
      >
        <option value="">{placeholder || "Select an option"}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FormNoticeBanner({ notice }: { notice: FormNotice }) {
  return (
    <div
      role={notice.tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-workspace-xl border px-4 py-3 text-sm",
        notice.tone === "error"
          ? "border-rose-200 bg-rose-50 text-rose-800"
          : "border-sky-200 bg-sky-50 text-sky-800",
      )}
    >
      {notice.message}
    </div>
  );
}

export function ClassSetupNotice() {
  return (
    <section
      className="rounded-workspace-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950"
      role="status"
    >
      <p className="font-semibold">Set up classes first</p>
      <p className="mt-1 leading-relaxed text-amber-900/90">
        Students and teachers must be linked to classes.{" "}
        <Link
          href="/app/admin/classes"
          className="font-semibold underline underline-offset-2 hover:text-amber-950"
        >
          Create classes
        </Link>{" "}
        (and subjects for teaching assignments), then return here.
      </p>
    </section>
  );
}

export function InlineSubjectCreatorCard({
  draft,
  loading,
  onChange,
  onCancel,
  onSubmit,
}: {
  draft: { name: string; code: string };
  loading: boolean;
  onChange: (value: { name: string; code: string }) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-workspace-xl border border-workspace-border bg-slate-50/80 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Subject name"
          value={draft.name}
          onChange={(value) => onChange({ ...draft, name: value })}
          required
        />
        <Field
          label="Subject code"
          value={draft.code}
          onChange={(value) => onChange({ ...draft, code: value })}
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={secondaryButton("text-sm")}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className={primaryButton("text-sm")}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}
          Create subject
        </button>
      </div>
    </div>
  );
}

export function InlineClassCreatorCard({
  draft,
  loading,
  onChange,
  onCancel,
  onSubmit,
}: {
  draft: { name: string; gradeLevel: string; capacity: string };
  loading: boolean;
  onChange: (value: {
    name: string;
    gradeLevel: string;
    capacity: string;
  }) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-workspace-xl border border-workspace-border bg-slate-50/80 p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Field
          label="Class name"
          value={draft.name}
          onChange={(value) => onChange({ ...draft, name: value })}
          required
        />
        <SelectField
          label="Grade level"
          value={draft.gradeLevel}
          onChange={(value) => onChange({ ...draft, gradeLevel: value })}
          options={[
            "",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "10",
            "11",
            "12",
            "13",
          ]}
        />
        <Field
          label="Capacity"
          type="number"
          value={draft.capacity}
          onChange={(value) => onChange({ ...draft, capacity: value })}
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={secondaryButton("text-sm")}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className={primaryButton("text-sm")}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}
          Create class
        </button>
      </div>
    </div>
  );
}
