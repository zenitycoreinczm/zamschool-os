const DRAFT_STORAGE_KEY = "zamschool-attendance-draft";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type AttendanceDraft = {
  lessonId: string;
  date: string;
  classId: string;
  className: string;
  subjectName: string;
  statuses: Record<string, { status: string; remarks: string | null }>;
  /** Set automatically on save when omitted. */
  timestamp?: number;
};

export function saveAttendanceDraft(draft: AttendanceDraft): void {
  try {
    const drafts = loadAllDrafts();
    const key = `${draft.lessonId}:${draft.date}`;
    drafts[key] = { ...draft, timestamp: Date.now() };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.error("Failed to save attendance draft:", error);
  }
}

export function loadAttendanceDraft(lessonId: string, date: string): AttendanceDraft | null {
  try {
    const drafts = loadAllDrafts();
    const key = `${lessonId}:${date}`;
    const draft = drafts[key];
    
    if (!draft) return null;
    
    // Check if draft is expired
    if (Date.now() - (draft.timestamp ?? 0) > DRAFT_TTL_MS) {
      delete drafts[key];
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
      return null;
    }
    
    return draft;
  } catch (error) {
    console.error("Failed to load attendance draft:", error);
    return null;
  }
}

export function deleteAttendanceDraft(lessonId: string, date: string): void {
  try {
    const drafts = loadAllDrafts();
    const key = `${lessonId}:${date}`;
    delete drafts[key];
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.error("Failed to delete attendance draft:", error);
  }
}

export function clearExpiredDrafts(): void {
  try {
    const drafts = loadAllDrafts();
    const now = Date.now();
    let hasExpired = false;
    
    for (const [key, draft] of Object.entries(drafts)) {
      if (now - (draft.timestamp ?? 0) > DRAFT_TTL_MS) {
        delete drafts[key];
        hasExpired = true;
      }
    }
    
    if (hasExpired) {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
    }
  } catch (error) {
    console.error("Failed to clear expired drafts:", error);
  }
}

function loadAllDrafts(): Record<string, AttendanceDraft> {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to load drafts:", error);
    return {};
  }
}
