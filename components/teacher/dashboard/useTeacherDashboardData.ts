"use client";

import { useCallback, useEffect, useState } from "react";

import { adminApiJson } from "@/lib/admin-browser-api";
import { isAbortLikeError } from "@/lib/async-guards";
import {
  normalizeAnnouncementRow,
  type AnnouncementRow,
  type LessonRow,
} from "@/components/teacher/dashboard/types";

type LoadResult = {
  todayLessons: LessonRow[];
  announcements: AnnouncementRow[];
};

const EMPTY: LoadResult = { todayLessons: [], announcements: [] };

export function useTeacherDashboardData(enabled: boolean) {
  const [todayLessons, setTodayLessons] = useState<LessonRow[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);

      try {
        const today = new Date().toISOString().slice(0, 10);
        const [lessonsRes, annRes] = await Promise.allSettled([
          adminApiJson<{ success: boolean; data: LessonRow[] }>(
            `/api/teacher/classes?date=${today}&limit=6`,
          ),
          adminApiJson<{ success: boolean; data: unknown[] }>(
            "/api/teacher/announcements?limit=2",
          ),
        ]);

        if (lessonsRes.status === "fulfilled" && lessonsRes.value?.data) {
          setTodayLessons(
            Array.isArray(lessonsRes.value.data) ? lessonsRes.value.data : [],
          );
        } else {
          setTodayLessons([]);
        }

        if (annRes.status === "fulfilled" && annRes.value?.data) {
          setAnnouncements(
            Array.isArray(annRes.value.data)
              ? annRes.value.data.map((row) =>
                  normalizeAnnouncementRow(
                    (row || {}) as Record<string, unknown>,
                  ),
                )
              : [],
          );
        } else {
          setAnnouncements([]);
        }
      } catch (error) {
        if (isAbortLikeError(error)) return EMPTY;
        // Non-critical: keep prior values so the page stays usable.
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (enabled) {
      void load("initial");
    }
  }, [enabled, load]);

  return {
    todayLessons,
    announcements,
    loading,
    refreshing,
    refresh: () => load("refresh"),
  };
}
