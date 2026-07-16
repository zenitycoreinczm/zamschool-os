"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  Filter,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { primaryButton, secondaryButton } from "@/lib/workspace/design";
import { adminApiJson } from "@/lib/admin-browser-api";
import { DateOnlyPicker } from "@/components/forms/DateTimePicker";

type DisciplineRecord = {
  id: string;
  title: string;
  description: string | null;
  incident_date: string;
  incident_location: string | null;
  severity: number;
  status: string;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  student: {
    id: string;
    student_number: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
  category: { id: string; name: string } | null;
  actions: Array<{
    id: string;
    action_type: string;
    description: string | null;
    action_date: string;
    duration_days: number | null;
  }>;
};

type DisciplineStats = {
  totalRecords: number;
  openCases: number;
  recentIncidents: number;
  severityBreakdown: Record<number, number>;
  statusBreakdown: Record<string, number>;
  topStudents: Array<{ studentId: string; count: number; name: string }>;
};

type Category = {
  id: string;
  name: string;
  description: string | null;
  severity: number;
  is_active: boolean;
};

type Student = {
  id: string;
  student_number: string | null;
  profile: { first_name: string | null; last_name: string | null } | null;
  class: { name: string } | null;
};

import { SEVERITY_LEVELS, DISCIPLINE_STATUS } from "@/lib/discipline-tokens";

const SEVERITY_LABELS = SEVERITY_LEVELS;
const STATUS_LABELS = DISCIPLINE_STATUS;

export default function DisciplineAdminPage() {
  const [records, setRecords] = useState<DisciplineRecord[]>([]);
  const [stats, setStats] = useState<DisciplineStats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form state
  const [newStudentId, setNewStudentId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newSeverity, setNewSeverity] = useState("1");
  const [newIncidentDate, setNewIncidentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [newLocation, setNewLocation] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterSeverity) params.set("severity", filterSeverity);
      params.set("limit", "100");

      const [recordsRes, statsRes, categoriesRes, studentsRes] =
        await Promise.all([
          adminApiJson(`/api/discipline/records?${params}`),
          adminApiJson("/api/discipline/stats"),
          adminApiJson("/api/discipline/categories"),
          adminApiJson("/api/admin/users?role=student&limit=500"),
        ]);

      setRecords(recordsRes.data || []);
      setStats(statsRes.data || null);
      setCategories(categoriesRes.data || []);
      setStudents(
        (studentsRes.data || []).map((s: any) => ({
          id: s.id,
          student_number: s.student_number || s.studentNumber || null,
          profile: s.profile || {
            first_name: s.firstName,
            last_name: s.lastName,
          },
          class: s.class || { name: s.className },
        })),
      );
    } catch {
      toast.error("Failed to load discipline data");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterSeverity]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async () => {
    if (!newStudentId || !newTitle.trim()) {
      toast.error("Student and title are required");
      return;
    }
    setCreating(true);
    try {
      await adminApiJson("/api/discipline/records", {
        method: "POST",
        body: JSON.stringify({
          studentId: newStudentId,
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          categoryId: newCategoryId || undefined,
          severity: parseInt(newSeverity, 10),
          incidentDate: newIncidentDate,
          incidentLocation: newLocation.trim() || undefined,
        }),
      });
      toast.success("Discipline record created");
      setShowCreateForm(false);
      setNewStudentId("");
      setNewTitle("");
      setNewDescription("");
      setNewCategoryId("");
      setNewSeverity("1");
      setNewIncidentDate(new Date().toISOString().split("T")[0]);
      setNewLocation("");
      loadData();
    } catch {
      toast.error("Failed to create record");
    } finally {
      setCreating(false);
    }
  };

  const filteredRecords = records.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = r.student
      ? `${r.student.first_name || ""} ${r.student.last_name || ""}`.toLowerCase()
      : "";
    return (
      name.includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.student?.student_number?.toLowerCase().includes(q)
    );
  });

  const getStudentName = (student: DisciplineRecord["student"]) => {
    if (!student) return "Unknown";
    return (
      [student.first_name, student.last_name].filter(Boolean).join(" ") ||
      "Student"
    );
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-4 py-8 md:p-6">
        <div className="flex items-center justify-center gap-3 py-20">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          <span className="text-sm text-slate-500">
            Loading conduct data…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 pb-8 md:p-6">
      <section className="overflow-hidden rounded-3xl border border-slate-800/40 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Conduct desk
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
              Discipline management
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Track incidents, consequences, and student conduct.
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
          >
            <Plus className="h-4 w-4" /> New record
          </button>
        </div>
      </section>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total records" value={stats.totalRecords} />
          <StatCard label="Open cases" value={stats.openCases} />
          <StatCard label="This week" value={stats.recentIncidents} />
          <StatCard
            label="Resolved"
            value={stats.statusBreakdown["resolved"] || 0}
          />
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-slate-900">
            New discipline record
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Student *
              </label>
              <select
                value={newStudentId}
                onChange={(e) => setNewStudentId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">Select student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.profile
                      ? `${s.profile.first_name || ""} ${s.profile.last_name || ""}`
                      : "Student"}
                    {s.student_number ? ` (${s.student_number})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Late to class"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Category
              </label>
              <select
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Severity {c.severity})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Severity
              </label>
              <select
                value={newSeverity}
                onChange={(e) => setNewSeverity(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                {[1, 2, 3, 4, 5].map((s) => (
                  <option key={s} value={s}>
                    {s} - {SEVERITY_LABELS[s].label}
                  </option>
                ))}
              </select>
            </div>
            <DateOnlyPicker
              value={newIncidentDate}
              onChange={setNewIncidentDate}
              label="Incident date"
              accent="slate"
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Location
              </label>
              <input
                type="text"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="e.g. Classroom 3B"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
                placeholder="Describe the incident..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleCreate}
              disabled={creating}
              className={primaryButton("")}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Record
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className={secondaryButton("")}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, title, or student number..."
            className="w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All Severity</option>
          {[1, 2, 3, 4, 5].map((s) => (
            <option key={s} value={s}>
              {s} - {SEVERITY_LABELS[s].label}
            </option>
          ))}
        </select>
      </div>

      {/* Records Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left">Student</th>
              <th className="px-4 py-3 text-left">Incident</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Severity</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRecords.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  No discipline records found.
                </td>
              </tr>
            ) : (
              filteredRecords.map((record) => {
                const severity =
                  SEVERITY_LABELS[record.severity] || SEVERITY_LABELS[1];
                const status =
                  STATUS_LABELS[record.status] || STATUS_LABELS.open;
                return (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">
                        {getStudentName(record.student)}
                      </div>
                      {record.student?.student_number && (
                        <div className="text-xs text-slate-500">
                          {record.student.student_number}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-700">
                        {record.title}
                      </div>
                      {record.incident_location && (
                        <div className="text-xs text-slate-500">
                          {record.incident_location}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {record.category?.name || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                          severity.color,
                        )}
                      >
                        {severity.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-1 text-xs font-medium",
                          status.color,
                        )}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {record.incident_date}
                    </td>
                    <td className="px-4 py-3">
                      {record.actions.length > 0 && (
                        <div className="text-xs text-slate-500">
                          {record.actions.length} action(s)
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Top Students */}
      {stats && stats.topStudents.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-900">
            Frequent Incidents (30 days)
          </h3>
          <div className="space-y-2">
            {stats.topStudents.map((s) => (
              <div
                key={s.studentId}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <span className="text-sm font-medium text-slate-800">
                  {s.name}
                </span>
                <span className="text-sm font-semibold tabular-nums text-slate-700">
                  {s.count} incident(s)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  tone?: "sky" | "amber" | "violet" | "emerald";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
