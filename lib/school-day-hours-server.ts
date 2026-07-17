import {
  DEFAULT_SCHOOL_DAY_HOURS,
  normalizeSchoolDayHours,
  SCHOOL_DAY_SETTING_KEY,
  type SchoolDayHours,
  validateSchoolDayHours,
} from "@/lib/school-day-hours";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Load school day hours from school_settings (key: school_day).
 * Falls back to safe defaults when missing.
 */
export async function loadSchoolDayHours(
  schoolId: string,
): Promise<SchoolDayHours> {
  const id = String(schoolId || "").trim();
  if (!id) return { ...DEFAULT_SCHOOL_DAY_HOURS };

  try {
    const { data, error } = await supabaseAdmin
      .from("school_settings")
      .select("setting_value")
      .eq("school_id", id)
      .eq("setting_key", SCHOOL_DAY_SETTING_KEY)
      .maybeSingle();

    if (error) {
      // Table/key issues — soft-default so consumers still work.
      console.warn("[school-day] load failed", error.message);
      return { ...DEFAULT_SCHOOL_DAY_HOURS };
    }

    if (!data?.setting_value) {
      return { ...DEFAULT_SCHOOL_DAY_HOURS };
    }

    return normalizeSchoolDayHours(data.setting_value);
  } catch (err) {
    console.warn("[school-day] load threw", err);
    return { ...DEFAULT_SCHOOL_DAY_HOURS };
  }
}

/**
 * Upsert school_day setting. Returns normalized hours or throws on validation.
 */
export async function saveSchoolDayHours(
  schoolId: string,
  raw: unknown,
): Promise<SchoolDayHours> {
  const id = String(schoolId || "").trim();
  if (!id) throw new Error("School id is required");

  const hours = normalizeSchoolDayHours(raw);
  const validationError = validateSchoolDayHours(hours);
  if (validationError) {
    const err = new Error(validationError) as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const row = {
    school_id: id,
    setting_key: SCHOOL_DAY_SETTING_KEY,
    setting_value: hours,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from("school_settings").upsert(row, {
    onConflict: "school_id,setting_key",
  });

  if (error) throw error;
  return hours;
}
