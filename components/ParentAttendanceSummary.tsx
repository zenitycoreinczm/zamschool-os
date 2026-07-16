"use client";

type AttendanceSummary = {
  PRESENT: number;
  ABSENT: number;
  LATE: number;
  EXCUSED: number;
};

const STATUS_CARDS: Array<{
  key: keyof AttendanceSummary;
  label: string;
}> = [
  { key: "PRESENT", label: "Present lessons" },
  { key: "ABSENT", label: "Absent lessons" },
  { key: "LATE", label: "Late arrivals" },
  { key: "EXCUSED", label: "Excused lessons" },
];

export default function ParentAttendanceSummary({
  summary,
  heading,
  rangeLabel,
  startDate,
  endDate,
}: {
  summary: AttendanceSummary;
  heading: string;
  rangeLabel: string;
  startDate: string;
  endDate: string;
}) {
  const totalLessons =
    summary.PRESENT + summary.ABSENT + summary.LATE + summary.EXCUSED;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">
            Attendance Summary
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">{heading}</h2>
          <p className="mt-2 text-sm text-slate-500">
            {rangeLabel} window from {formatDate(startDate)} to {formatDate(endDate)}.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            Total lessons
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totalLessons}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STATUS_CARDS.map((card) => (
          <div
            key={card.key}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
          >
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              {card.label}
            </p>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-slate-900">
              {summary[card.key]}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
