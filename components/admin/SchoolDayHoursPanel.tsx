"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { adminApiJson } from "@/lib/admin-browser-api";
import { Surface } from "@/components/workspace/Surface";
import {
  DEFAULT_MORNING_REMINDER_OFFSETS,
  type SchoolDayHours,
} from "@/lib/school-day-hours";

type HoursPayload = SchoolDayHours & {
  morningReminders?: Array<{
    fireAt: string;
    label: string;
    title: string;
    body: string;
  }>;
  classWindowLabel?: string;
  schoolOpenLabel?: string;
};

type Props = {
  canEdit: boolean;
  /** When false, panel is read-only for academic staff / others. */
  schoolReady?: boolean;
};

const EMPTY: SchoolDayHours = {
  timezone: "Africa/Lusaka",
  schoolOpensAt: "07:00",
  classesStartAt: "08:00",
  classesEndAt: "16:00",
  schoolClosesAt: "16:30",
  morningReminderOffsetsMinutes: [...DEFAULT_MORNING_REMINDER_OFFSETS],
};

export function SchoolDayHoursPanel({
  canEdit,
  schoolReady = true,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SchoolDayHours>(EMPTY);
  const [preview, setPreview] = useState<HoursPayload | null>(null);

  const load = useCallback(async () => {
    if (!schoolReady) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const body = await adminApiJson<{ data?: HoursPayload }>(
        "/api/admin/school-hours",
      );
      const data = body.data;
      if (data) {
        setForm({
          timezone: data.timezone || EMPTY.timezone,
          schoolOpensAt: data.schoolOpensAt || EMPTY.schoolOpensAt,
          classesStartAt: data.classesStartAt || EMPTY.classesStartAt,
          classesEndAt: data.classesEndAt || EMPTY.classesEndAt,
          schoolClosesAt: data.schoolClosesAt || EMPTY.schoolClosesAt,
          morningReminderOffsetsMinutes:
            data.morningReminderOffsetsMinutes ||
            EMPTY.morningReminderOffsetsMinutes,
        });
        setPreview(data);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load school hours";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [schoolReady]);

  useEffect(() => {
    void load();
  }, [load]);

  const offsetsLabel = useMemo(
    () =>
      (form.morningReminderOffsetsMinutes || [])
        .slice()
        .sort((a, b) => b - a)
        .map((m) => {
          const h = Math.floor(m / 60);
          const min = m % 60;
          if (h && min) return `${h}h ${min}m before`;
          if (h) return `${h}h before`;
          return `${min}m before`;
        })
        .join(" · "),
    [form.morningReminderOffsetsMinutes],
  );

  const onChange = (key: keyof SchoolDayHours, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSave = async () => {
    if (!canEdit) {
      toast.error("Only the Head Teacher can set school day hours.");
      return;
    }
    setSaving(true);
    const toastId = toast.loading("Saving school day hours...");
    try {
      const body = await adminApiJson<{ data?: HoursPayload }>(
        "/api/admin/school-hours",
        {
          method: "PUT",
          body: JSON.stringify({
            timezone: form.timezone.trim() || "Africa/Lusaka",
            schoolOpensAt: form.schoolOpensAt,
            classesStartAt: form.classesStartAt,
            classesEndAt: form.classesEndAt,
            schoolClosesAt: form.schoolClosesAt,
            morningReminderOffsetsMinutes: form.morningReminderOffsetsMinutes,
          }),
        },
      );
      if (body.data) {
        setPreview(body.data);
        setForm({
          timezone: body.data.timezone,
          schoolOpensAt: body.data.schoolOpensAt,
          classesStartAt: body.data.classesStartAt,
          classesEndAt: body.data.classesEndAt,
          schoolClosesAt: body.data.schoolClosesAt,
          morningReminderOffsetsMinutes:
            body.data.morningReminderOffsetsMinutes,
        });
      }
      toast.success(
        "School day hours saved. Timetables and mobile morning reminders will use these times.",
        { id: toastId },
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save school hours";
      toast.error(message, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (!schoolReady) {
    return null;
  }

  if (loading) {
    return (
      <Surface
        variant="default"
        className="flex items-center gap-3 p-5 text-sm text-slate-500"
        as="div"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading school day hours...
      </Surface>
    );
  }

  return (
    <Surface variant="default" className="space-y-5 p-5 md:p-6" as="div">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-violet-50 p-2 text-violet-700">
            <Clock3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              School day hours
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Set when campus opens and when classes run. Academic Admin uses
              this for timetables. Students on the mobile app get morning
              reminders before classes start.
            </p>
          </div>
        </div>
      </div>

      {!canEdit ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          View only. Only the Head Teacher can change school day hours.
        </p>
      ) : null}

      <fieldset
        disabled={!canEdit}
        className="grid gap-4 sm:grid-cols-2 disabled:opacity-90"
      >
        <TimeField
          label="School opens"
          hint="Gates / campus open"
          value={form.schoolOpensAt}
          onChange={(v) => onChange("schoolOpensAt", v)}
        />
        <TimeField
          label="Classes start"
          hint="First lesson may begin"
          value={form.classesStartAt}
          onChange={(v) => onChange("classesStartAt", v)}
        />
        <TimeField
          label="Classes end"
          hint="Last lesson should finish by"
          value={form.classesEndAt}
          onChange={(v) => onChange("classesEndAt", v)}
        />
        <TimeField
          label="School closes"
          hint="Campus close"
          value={form.schoolClosesAt}
          onChange={(v) => onChange("schoolClosesAt", v)}
        />
        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Timezone
          </span>
          <input
            value={form.timezone}
            onChange={(e) => onChange("timezone", e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
            placeholder="Africa/Lusaka"
          />
        </label>
      </fieldset>

      <div className="rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3 text-sm text-slate-700">
        <p className="font-semibold text-violet-900">
          Student morning reminders (mobile)
        </p>
        <p className="mt-1 text-slate-600">
          Before classes start at{" "}
          <span className="font-semibold text-slate-900">
            {form.classesStartAt}
          </span>
          , the app nudges students at:{" "}
          <span className="font-medium text-slate-800">
            {offsetsLabel || "default offsets"}
          </span>
          .
        </p>
        {preview?.morningReminders && preview.morningReminders.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {preview.morningReminders.map((slot) => (
              <li
                key={`${slot.fireAt}-${slot.label}`}
                className="flex flex-wrap items-baseline gap-x-2 text-xs sm:text-sm"
              >
                <span className="font-semibold tabular-nums text-violet-800">
                  {slot.fireAt}
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-700">
                  {slot.title} ({slot.label} left)
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2 text-xs text-slate-500">
          Default offsets: 2h, 1h30, 1h, and 30 min before class start (e.g.
          06:00, 06:30, 07:00, 07:30 when classes start at 08:00).
        </p>
      </div>

      {canEdit ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save school day hours
          </button>
        </div>
      ) : null}
    </Surface>
  );
}

function TimeField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {hint ? (
        <span className="mb-1.5 block text-xs text-slate-500">{hint}</span>
      ) : null}
      <input
        type="time"
        value={value.slice(0, 5)}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
      />
    </label>
  );
}
