"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { getDisplayName } from "@/lib/profile-utils";
import { formatKwacha } from "@/lib/zambia-localization";
import {
  buildDetailBio,
  buildPrimaryAssignment,
  buildPrimaryDate,
  formatDateLabel,
} from "./helpers";
import type { GenericRow } from "./types";

export function UserDetailDashboard({
  detailData,
  detailTarget,
  detailRole,
  onEdit,
}: {
  detailData: GenericRow;
  detailTarget: GenericRow | null;
  detailRole: string;
  onEdit: () => void;
}) {
  const displayName = detailData.displayName || getDisplayName(detailTarget);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[1.12fr_1fr]">
        <div className="rounded-[26px] bg-[#c9f1fb] p-5 text-slate-900">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <ProfileAvatar
              name={displayName}
              src={detailData.avatarUrl}
              role={detailRole}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {String(detailData.role || detailRole).toUpperCase()}
                  </p>
                  <h3 className="mt-2 text-3xl font-semibold tracking-[-0.01em] text-slate-950">
                    {displayName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={onEdit}
                  className="grid h-10 w-10 place-items-center rounded-full bg-slate-900/75 text-white shadow-sm hover:bg-slate-900"
                  aria-label="Edit profile"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                {buildDetailBio(detailData, detailRole)}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MiniInfo value={detailData.email || "No email recorded"} />
                <MiniInfo value={detailData.status || "Status pending"} />
                <MiniInfo value={buildPrimaryDate(detailData, detailRole)} />
                <MiniInfo value={buildPrimaryAssignment(detailData, detailRole)} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {buildProfileStats(detailData, detailRole).map((stat) => (
            <ProfileStat key={stat.label} {...stat} />
          ))}
        </div>
      </div>

      {detailRole === "teacher" ? (
        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
          <SchedulePanel
            lessons={detailData.oversight?.recentAttendance || []}
          />
          <ShortcutPanel
            items={[
              "Teacher's Classes",
              "Teacher's Students",
              "Teacher's Lessons",
              "Teacher's Exams",
              "Teacher's Assignments",
            ]}
          />
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        {detailRole === "teacher" ? (
          <>
            <DetailListCard
              title="Supervised Classes"
              emptyLabel="No supervised classes"
              items={detailData.supervisedClasses || []}
              renderItem={(item: any) => item.name || "Class"}
            />
            <DetailListCard
              title="Teaching Classes"
              emptyLabel="No teaching classes"
              items={detailData.assignedClasses || []}
              renderItem={(item: any) => item.name || "Class"}
            />
            <DetailListCard
              title="Assigned Subjects"
              emptyLabel="No assigned subjects"
              items={detailData.assignedSubjects || []}
              renderItem={(item: any) => item.name || "Subject"}
            />
          </>
        ) : detailRole === "student" ? (
          <>
            <DetailListCard
              title="Guardians"
              emptyLabel="No guardians linked"
              items={detailData.guardians || []}
              renderItem={(item: any) =>
                `${item.name || "Guardian"}${item.relationship ? ` - ${item.relationship}` : ""}`
              }
            />
            <DetailActivityCard
              title="Recent Results"
              emptyLabel="No results available"
              items={detailData.results?.rows || []}
              renderBody={(item: any) => (
                <>
                  <p className="font-medium text-slate-800">
                    {item.subjectName || "Subject"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.score ?? "-"} {item.grade ? `(${item.grade})` : ""} -{" "}
                    {item.date ? formatDateLabel(item.date) : "-"}
                  </p>
                </>
              )}
            />
            <DetailActivityCard
              title="Recent Payments"
              emptyLabel="No payment history"
              items={detailData.finance?.recentPayments || []}
              renderBody={(item: any) => (
                <>
                  <p className="font-medium text-slate-800">
                    {formatKwacha(Number(item.amount ?? 0), { symbol: "K" })}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.status || "Payment"} -{" "}
                    {item.date ? formatDateLabel(item.date) : "-"}
                  </p>
                </>
              )}
            />
          </>
        ) : (
          <>
            <DetailListCard
              title="Linked Children"
              emptyLabel="No linked children"
              items={detailData.linkedChildren || []}
              renderItem={(item: any) =>
                `${item.name || "Student"}${item.className ? ` - ${item.className}` : ""}`
              }
            />
            <DetailMetaPanel
              title="Parent Profile"
              rows={[
                ["Relation", detailData.relationType || "-"],
                ["Occupation", detailData.occupation || "-"],
                ["Unread alerts", String(detailData.alerts?.unreadCount || 0)],
              ]}
            />
            <ShortcutPanel
              items={[
                "Children",
                "Attendance",
                "Results",
                "Messages",
                "Payments",
              ]}
            />
          </>
        )}
      </div>

      {detailRole === "teacher" ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <DetailActivityCard
            title="Recent Attendance Activity"
            emptyLabel="No attendance activity recorded"
            items={detailData.oversight?.recentAttendance || []}
            renderBody={(item: any) => (
              <>
                <p className="font-medium text-slate-800">
                  {item.sessionName || "Lesson"}
                </p>
                <p className="text-xs text-slate-500">
                  {item.date ? formatDateLabel(item.date) : "No date"} -{" "}
                  {item.status || "Recorded"}
                </p>
              </>
            )}
          />
          <DetailActivityCard
            title="Recent Assignments"
            emptyLabel="No assignments created"
            items={detailData.oversight?.recentAssignments || []}
            renderBody={(item: any) => (
              <>
                <p className="font-medium text-slate-800">
                  {item.title || "Assignment"}
                </p>
                <p className="text-xs text-slate-500">
                  {item.className || "Class"} - Due{" "}
                  {item.dueDate ? formatDateLabel(item.dueDate) : "-"}
                </p>
              </>
            )}
          />
          <DetailActivityCard
            title="Recent Results Activity"
            emptyLabel="No results entered"
            items={detailData.oversight?.recentResults || []}
            renderBody={(item: any) => (
              <>
                <p className="font-medium text-slate-800">
                  {item.studentName || "Student"}
                </p>
                <p className="text-xs text-slate-500">
                  {item.subjectName || "Subject"} - {item.score ?? "-"}{" "}
                  {item.grade ? `(${item.grade})` : ""}
                </p>
              </>
            )}
          />
        </div>
      ) : null}
    </div>
  );
}

function ProfileAvatar({
  name,
  src,
  role,
}: {
  name: string;
  src?: string | null;
  role: string;
}) {
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") ||
    role[0]?.toUpperCase() ||
    "U";
  const [imgBroken, setImgBroken] = useState(false);

  return (
    <div className="h-36 w-36 shrink-0 overflow-hidden rounded-full bg-white/80 shadow-sm ring-8 ring-white/35">
      {src && !imgBroken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImgBroken(true)}
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-900 to-sky-700 text-4xl font-semibold text-white">
          {initials}
        </div>
      )}
    </div>
  );
}

function MiniInfo({ value }: { value: string }) {
  return (
    <div className="min-w-0 text-sm font-medium text-slate-800">
      <span className="truncate">{value}</span>
    </div>
  );
}

function ProfileStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-2xl font-semibold tabular-nums text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{label}</p>
    </div>
  );
}

function SchedulePanel({ lessons }: { lessons: any[] }) {
  const visibleLessons = lessons.slice(0, 8);
  const timeLabels = ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM"];

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-950">
          Teacher Schedule
        </h3>
        <div className="flex rounded-xl bg-violet-50 p-1 text-xs font-medium text-slate-600">
          <span className="rounded-lg bg-violet-200/70 px-3 py-1.5">
            Work Week
          </span>
          <span className="px-3 py-1.5">Day</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-[80px_repeat(4,minmax(0,1fr))] overflow-hidden rounded-2xl border border-slate-100 text-sm">
        {timeLabels.map((time, rowIndex) => (
          <div className="contents" key={time}>
            <div className="border-b border-r border-slate-100 bg-slate-50/70 px-3 py-4 text-xs text-slate-500">
              {time}
            </div>
            {[0, 1, 2, 3].map((columnIndex) => {
              const lesson = visibleLessons[rowIndex * 2 + columnIndex];
              return (
                <div
                  key={`${time}-${columnIndex}`}
                  className="min-h-20 border-b border-r border-slate-100 bg-sky-50/20 p-2"
                >
                  {lesson ? (
                    <div
                      className={`h-full rounded-xl px-3 py-2 ${columnIndex % 3 === 0 ? "bg-sky-100" : columnIndex % 3 === 1 ? "bg-amber-50" : "bg-violet-50"}`}
                    >
                      <p className="text-xs text-slate-500">
                        {lesson.sessionTime || lesson.date || "Recorded"}
                      </p>
                      <p className="mt-1 font-medium text-slate-900">
                        {lesson.sessionName || "Lesson"}
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ShortcutPanel({ items }: { items: string[] }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-950">Shortcuts</h3>
      <div className="mt-4 flex flex-wrap gap-3">
        {items.map((item, index) => (
          <span
            key={item}
            className={`rounded-xl px-4 py-3 text-sm font-medium text-slate-600 ${
              index % 3 === 0
                ? "bg-sky-50"
                : index % 3 === 1
                  ? "bg-violet-50"
                  : "bg-amber-50"
            }`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function DetailMetaPanel({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-slate-50 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              {label}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailListCard({
  title,
  items,
  emptyLabel,
  renderItem,
}: {
  title: string;
  items: any[];
  emptyLabel: string;
  renderItem: (item: any) => string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 space-y-2">
        {items?.length ? (
          items.map((item, index) => (
            <div
              key={item?.id || `${title}-${index}`}
              className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-700"
            >
              {renderItem(item)}
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}

function DetailActivityCard({
  title,
  items,
  emptyLabel,
  renderBody,
}: {
  title: string;
  items: any[];
  emptyLabel: string;
  renderBody: (item: any) => any;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 space-y-3">
        {items?.length ? (
          items.map((item, index) => (
            <div
              key={item?.id || `${title}-${index}`}
              className="rounded-2xl border border-slate-100 px-3 py-3"
            >
              {renderBody(item)}
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}

function buildProfileStats(detailData: GenericRow, detailRole: string) {
  if (detailRole === "teacher") {
    return [
      {
        label: "Classes",
        value: detailData.oversight?.stats?.teachingClasses || 0,
      },
      {
        label: "Lessons",
        value: detailData.oversight?.stats?.weeklyLessons || 0,
      },
      {
        label: "Assignments",
        value: detailData.oversight?.stats?.assignments || 0,
      },
      {
        label: "Roll Calls",
        value: detailData.oversight?.stats?.pendingRollCalls || 0,
      },
    ];
  }

  if (detailRole === "student") {
    return [
      {
        label: "Average",
        value: detailData.results?.average ?? "-",
      },
      {
        label: "Present",
        value: detailData.attendance?.present || 0,
      },
      {
        label: "Absent",
        value: detailData.attendance?.absent || 0,
      },
      {
        label: "Balance",
        value: formatKwacha(Number(detailData.finance?.balance || 0), {
          symbol: "K",
        }),
      },
    ];
  }

  return [
    {
      label: "Children",
      value: detailData.linkedChildren?.length || 0,
    },
    {
      label: "Unread Alerts",
      value: detailData.alerts?.unreadCount || 0,
    },
    {
      label: "Relation",
      value: detailData.relationType || "-",
    },
    {
      label: "Status",
      value: detailData.status || "-",
    },
  ];
}
