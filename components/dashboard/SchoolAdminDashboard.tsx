"use client";

import UserCard, { type UserCardPeopleMode } from "@/components/UserCard";
import CountChart from "@/components/CountChart";
import AttendanceChart from "@/components/AttendanceChart";
import FinanceChart from "@/components/FinanceChart";
import EventCalendar from "@/components/EventCalendar";
import Announcements from "@/components/Announcements";

/**
 * Classic school administrator dashboard (user counts, charts, calendar, announcements).
 * Matches the dense layout shown in pics/dashboard.png.
 */
export default function SchoolAdminDashboard({
  peopleMode = "directory",
}: {
  /** Head Teacher: leadership/teacher cards open Invite staff; no Users directory. */
  peopleMode?: UserCardPeopleMode;
}) {
  return (
    <div className="flex flex-col gap-4 py-1">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <UserCard type="admin" peopleMode={peopleMode} />
        <UserCard type="teacher" peopleMode={peopleMode} />
        <UserCard type="student" peopleMode={peopleMode} />
        <UserCard type="parent" peopleMode={peopleMode} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
            <div className="min-h-[340px]">
              <CountChart />
            </div>
            <div className="h-[340px]">
              <AttendanceChart />
            </div>
          </div>

          <div className="h-[360px]">
            <FinanceChart />
          </div>

          <Announcements />
        </div>

        <div className="min-w-0">
          <EventCalendar />
        </div>
      </div>
    </div>
  );
}
