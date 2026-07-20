"use client";

import { useEffect, useRef, useState } from "react";
import { adminApiJson } from "@/lib/admin-browser-api";
import {
  buildManagedAccountPayload,
  normalizeEmail,
  normalizeImportRow,
  normalizeOptionalString,
  readClassField,
  resolveClassId,
  type ClassOption,
  type ImportRow,
} from "@/lib/bulk-import-helpers";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import Papa from "papaparse";
import { toast } from "sonner";

interface BulkImportProps {
  role: "STUDENT" | "TEACHER" | "PARENT";
  onComplete?: () => void;
}

type ImportedCredential = {
  email: string;
  temporaryPassword: string;
};

export default function BulkImport({ role, onComplete }: BulkImportProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [parsedData, setParsedData] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [credentials, setCredentials] = useState<ImportedCredential[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classesLoading, setClassesLoading] = useState(role === "STUDENT");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (role !== "STUDENT") {
      setClassesLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setClassesLoading(true);
      try {
        const body = await adminApiJson<{ data?: Array<{ id?: string; name?: string }> }>(
          "/api/admin/classes",
        );
        if (cancelled) return;
        const list = Array.isArray(body?.data)
          ? body.data.flatMap((row) => {
              const id = String(row?.id || "").trim();
              const name = String(row?.name || "").trim();
              return id && name ? [{ id, name }] : [];
            })
          : [];
        setClasses(list);
      } catch {
        if (!cancelled) {
          setClasses([]);
          toast.error(
            "Could not load classes. Create a class first (e.g. Form 1), then re-upload.",
          );
        }
      } finally {
        if (!cancelled) setClassesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);

  const getTemplate = () => {
    const templates = {
      STUDENT:
        "name,email,admission_number,gender,date_of_birth,phone,status,class\nJohn Banda,john.banda@school.com,ADM001,Male,2010-05-15,0970000000,Active,Form 1",
      TEACHER:
        "name,email,employee_id,gender,phone,status\nJane Phiri,jane.phiri@school.com,EMP001,Female,0970000001,Active",
      PARENT: "name,email,phone\nRobert Zulu,robert.zulu@example.com,0970000002",
    };
    return templates[role];
  };

  const downloadTemplate = () => {
    const blob = new Blob([getTemplate()], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${role.toLowerCase()}_import_template.csv`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setCredentials([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => String(header || "").trim(),
      complete: (results) => {
        validateData((results.data as ImportRow[]) || []);
      },
      error: (error) => {
        toast.error("Failed to parse CSV file");
        console.error(error);
      },
    });
  };

  const validateData = (data: ImportRow[]) => {
    const nextErrors: Array<{ row: number; message: string }> = [];
    const classNames = classes.map((c) => c.name).join(", ");

    const validatedData = data.map((raw, index) => {
      const row = normalizeImportRow(raw);

      if (!normalizeOptionalString(row.name)) {
        nextErrors.push({ row: index + 1, message: "Name is required" });
      }

      if (!normalizeEmail(row.email)) {
        nextErrors.push({ row: index + 1, message: "Email is required" });
      }

      if (role === "STUDENT" && !normalizeOptionalString(row.admission_number)) {
        nextErrors.push({
          row: index + 1,
          message: "Admission number is required",
        });
      }

      if (role === "STUDENT") {
        const classRef = readClassField(row);
        if (!classRef) {
          nextErrors.push({
            row: index + 1,
            message:
              "Class is required (use the class column, e.g. Form 1). Create the class under Classes first.",
          });
        } else if (classes.length === 0 && !classesLoading) {
          nextErrors.push({
            row: index + 1,
            message:
              "No classes found in this school. Create “Form 1” (or your class name) under Classes, then re-upload.",
          });
        } else if (!resolveClassId(classRef, classes)) {
          nextErrors.push({
            row: index + 1,
            message: classNames
              ? `Class “${classRef}” not found. Available: ${classNames}`
              : `Class “${classRef}” not found. Create it under Classes first.`,
          });
        }
      }

      if (role === "TEACHER" && !normalizeOptionalString(row.employee_id)) {
        nextErrors.push({ row: index + 1, message: "Employee ID is required" });
      }

      return row;
    });

    setErrors(nextErrors);
    setParsedData(validatedData);
    setShowPreview(true);
  };

  const processImport = async () => {
    if (errors.length > 0) {
      toast.error("Please fix errors before importing");
      return;
    }

    if (role === "STUDENT" && classes.length === 0) {
      toast.error("Create at least one class before bulk-importing students.");
      return;
    }

    setIsUploading(true);
    const loadingToast = toast.loading(
      `Importing ${parsedData.length} ${role.toLowerCase()}s...`,
    );

    try {
      const issuedCredentials: ImportedCredential[] = [];
      let successCount = 0;

      for (let index = 0; index < parsedData.length; index += 1) {
        const row = parsedData[index];
        const payload = buildManagedAccountPayload(role, row, classes);

        const body = await adminApiJson<{
          email?: string;
          temporaryPassword?: string;
        }>("/api/admin/users", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        successCount += 1;
        if (body?.temporaryPassword) {
          issuedCredentials.push({
            email: String(body.email || payload.email),
            temporaryPassword: String(body.temporaryPassword),
          });
        }
      }

      setCredentials(issuedCredentials);
      setShowPreview(false);
      setParsedData([]);
      setSelectedFileName("");
      toast.success(`Successfully imported ${successCount} records`, {
        id: loadingToast,
      });
      onComplete?.();
    } catch (error: any) {
      toast.error(error?.message || "Import failed", { id: loadingToast });
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileDialog = () => {
    fileInputRef.current?.click();
  };

  const downloadCredentials = () => {
    if (credentials.length === 0) return;

    const header = "email,temporary_password";
    const rows = credentials.map((entry) =>
      [escapeCsv(entry.email), escapeCsv(entry.temporaryPassword)].join(","),
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${role.toLowerCase()}_import_credentials.csv`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const copyCredentials = async () => {
    if (credentials.length === 0) return;

    const text = credentials
      .map(
        (entry) =>
          `Email: ${entry.email}\nTemporary Password (one-time): ${entry.temporaryPassword}\nThe user must change this password on first mobile login.`,
      )
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(text);
      toast.success("Credentials copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="w-full space-y-4">
      {role === "STUDENT" ? (
        <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2 text-xs text-sky-950">
          <p className="font-semibold">Students need a class column</p>
          <p className="mt-0.5 text-sky-900/80">
            Your CSV must include <code className="font-mono">class</code> (e.g.{" "}
            <code className="font-mono">Form 1</code>). That name must already
            exist under Registrar → Classes
            {classes.length > 0
              ? ` — currently: ${classes.map((c) => c.name).join(", ")}`
              : classesLoading
                ? " — loading classes…"
                : " — none found yet; create Form 1 first"}.
          </p>
        </div>
      ) : null}

      {!showPreview ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 transition-colors hover:bg-slate-50">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-lamaSky/10">
            <Upload className="h-8 w-8 text-lamaSky" />
          </div>
          <h3 className="mb-2 text-lg font-bold text-slate-800">
            Bulk Import {role}s
          </h3>
          <p className="mb-6 max-w-xs text-center text-sm text-slate-500">
            Upload a CSV file to import multiple {role.toLowerCase()}s at once.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={downloadTemplate}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Download Template
            </button>

            <button
              type="button"
              onClick={triggerFileDialog}
              disabled={role === "STUDENT" && classesLoading}
              className="flex items-center gap-2 rounded-xl bg-lamaSky px-6 py-2 text-sm font-bold text-white shadow-lg shadow-lamaSky/20 transition-all hover:bg-opacity-90 disabled:opacity-60"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {role === "STUDENT" && classesLoading
                ? "Loading classes…"
                : "Select CSV File"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="sr-only"
            />
          </div>

          {selectedFileName ? (
            <p className="mt-3 text-xs text-slate-500" aria-live="polite">
              Selected file:{" "}
              <span className="font-medium text-slate-700">{selectedFileName}</span>
            </p>
          ) : null}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <h3 className="font-bold text-slate-800">
                Import Preview ({parsedData.length} rows)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="rounded-full p-1 transition-colors hover:bg-slate-200"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          <div className="max-h-[400px] overflow-auto">
            {errors.length > 0 ? (
              <div className="border-b border-red-100 bg-red-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-bold">
                    Validation Errors Found ({errors.length})
                  </span>
                </div>
                <ul className="space-y-1 text-xs text-red-500">
                  {errors.slice(0, 12).map((error, i) => (
                    <li key={`${error.row}-${i}`}>
                      Row {error.row}: {error.message}
                    </li>
                  ))}
                  {errors.length > 12 ? (
                    <li>…and {errors.length - 12} more</li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left font-bold">#</th>
                  <th className="px-4 py-2 text-left font-bold">Name</th>
                  <th className="px-4 py-2 text-left font-bold">Email</th>
                  {role === "STUDENT" ? (
                    <>
                      <th className="px-4 py-2 text-left font-bold">Adm. No</th>
                      <th className="px-4 py-2 text-left font-bold">Class</th>
                    </>
                  ) : null}
                  {role === "TEACHER" ? (
                    <th className="px-4 py-2 text-left font-bold">Emp. ID</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {parsedData.map((row, index) => (
                  <tr
                    key={`${normalizeOptionalString(row.email) || "row"}-${index}`}
                    className="border-b border-slate-50 hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-2 text-slate-400">{index + 1}</td>
                    <td className="px-4 py-2 font-medium text-slate-700">
                      {String(row.name ?? "")}
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {String(row.email ?? "")}
                    </td>
                    {role === "STUDENT" ? (
                      <>
                        <td className="px-4 py-2 text-slate-500">
                          {String(row.admission_number ?? "")}
                        </td>
                        <td className="px-4 py-2 text-slate-500">
                          {readClassField(row) || "—"}
                        </td>
                      </>
                    ) : null}
                    {role === "TEACHER" ? (
                      <td className="px-4 py-2 text-slate-500">
                        {String(row.employee_id ?? "")}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 p-4">
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className="rounded-xl px-4 py-2 font-bold text-slate-600 transition-colors hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void processImport()}
              disabled={isUploading || errors.length > 0}
              className="flex items-center gap-2 rounded-xl bg-lamaSky px-6 py-2 font-bold text-white shadow-lg shadow-lamaSky/20 transition-all hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm Import
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {credentials.length > 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="font-semibold text-emerald-950">
                Imported credentials
              </h4>
              <p className="mt-1 text-sm text-emerald-800">
                Save these one-time passwords — users must change them on first
                login.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void copyCredentials()}
                className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-900 transition-colors hover:bg-emerald-50"
              >
                Copy all
              </button>
              <button
                type="button"
                onClick={downloadCredentials}
                className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-900 transition-colors hover:bg-emerald-50"
              >
                Download CSV
              </button>
            </div>
          </div>

          <div className="mt-4 max-h-64 overflow-auto rounded-xl border border-emerald-100 bg-white">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-emerald-50 text-emerald-900">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Email</th>
                  <th className="px-4 py-2 text-left font-semibold">
                    Temporary password
                  </th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((entry) => (
                  <tr key={entry.email} className="border-t border-emerald-50">
                    <td className="px-4 py-2 text-slate-700">{entry.email}</td>
                    <td className="px-4 py-2 font-mono text-slate-900">
                      {entry.temporaryPassword}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function escapeCsv(value: string) {
  const text = String(value || "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}
