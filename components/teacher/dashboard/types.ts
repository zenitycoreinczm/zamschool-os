export type LessonRow = {
  id: string;
  date: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  startTime: string;
  endTime: string;
  rosterCount: number;
};

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string | null;
  authorName: string | null;
  authorRole?: string | null;
  createdAt: string | null;
  priority: string | null;
};

/** Normalize teacher announcement API rows (snake_case or camelCase). */
export function normalizeAnnouncementRow(
  row: Record<string, unknown>,
): AnnouncementRow {
  const createdAt =
    (typeof row.createdAt === "string" && row.createdAt) ||
    (typeof row.created_at === "string" && row.created_at) ||
    (typeof row.published_at === "string" && row.published_at) ||
    null;
  return {
    id: String(row.id ?? ""),
    title: String(row.title || "Announcement"),
    body:
      typeof row.body === "string"
        ? row.body
        : typeof row.content === "string"
          ? row.content
          : null,
    authorName:
      typeof row.authorName === "string"
        ? row.authorName
        : typeof row.author_name === "string"
          ? row.author_name
          : null,
    authorRole:
      typeof row.authorRole === "string"
        ? row.authorRole
        : typeof row.author_role === "string"
          ? row.author_role
          : null,
    createdAt,
    priority: typeof row.priority === "string" ? row.priority : null,
  };
}
