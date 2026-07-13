"use client";

type AccountsSetupGuideProps = {
  onOpenStaffInvites?: () => void;
};

export function AccountsSetupGuide({
  onOpenStaffInvites,
}: AccountsSetupGuideProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Students, parents & teachers
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          Create school community logins here — not in the staff invitations
          panel.
        </p>
        <ol className="mt-4 space-y-2 text-sm text-slate-600">
          <li className="flex gap-2">
            <span className="font-semibold text-sky-600">1.</span>
            <span>
              Pick the{" "}
              <strong className="font-medium text-slate-800">Students</strong>,{" "}
              <strong className="font-medium text-slate-800">Teachers</strong>, or{" "}
              <strong className="font-medium text-slate-800">Parents</strong> tab
              below.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-sky-600">2.</span>
            <span>
              Click{" "}
              <strong className="font-medium text-slate-800">
                Add student / teacher / parent
              </strong>{" "}
              in the header (top right).
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-sky-600">3.</span>
            <span>
              Share the one-time password shown after save. They sign in at{" "}
              <span className="font-medium text-slate-800">/login</span> and
              complete first-login setup.
            </span>
          </li>
        </ol>
        <p className="mt-4 text-xs font-medium text-slate-500">
          Assign classes from the directory after accounts exist.
        </p>
      </article>

      <article className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Office & leadership staff
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Deputy Head, Bursar, Registrar, ICT, HR, and other office staff are{" "}
          <strong className="font-medium text-slate-800">invited</strong> in the
          panel below — not through the Add student/teacher/parent button. The
          Head Teacher account is only created when the school is registered.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          <li>
            Use{" "}
            <strong className="font-medium text-slate-800">
              Invite Deputy Head
            </strong>{" "}
            or{" "}
            <strong className="font-medium text-slate-800">
              Invite other staff
            </strong>
            .
          </li>
          <li>
            Pending invites and temporary passwords appear in that same section.
          </li>
        </ul>
        {onOpenStaffInvites ? (
          <button
            type="button"
            onClick={onOpenStaffInvites}
            className="mt-4 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Open staff invitations ↓
          </button>
        ) : null}
      </article>
    </div>
  );
}
