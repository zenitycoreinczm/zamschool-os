"use client";

import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-workspace-2xl border border-slate-200 bg-white p-8 text-center shadow-workspace-xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-sky-50 ring-1 ring-sky-100">
          <FileQuestion className="h-8 w-8 text-sky-600" />
        </div>

        <h1 className="mb-1 text-5xl font-extrabold tracking-tight text-slate-900">
          404
        </h1>

        <h2 className="mb-2 text-xl font-semibold text-slate-900">
          Page Not Found
        </h2>

        <p className="mb-8 text-sm leading-relaxed text-slate-600">
          The page you&apos;re looking for doesn&apos;t exist or has been
          moved.
        </p>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700"
          >
            <Home className="h-4 w-4" />
            Return home
          </Link>

          <button
            onClick={() => window.history.back()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
