export type WorkspaceSearchKind =
  | "page"
  | "person"
  | "class"
  | "subject"
  | "announcement"
  | "event"
  | "assignment";

export type WorkspaceSearchResult = {
  id: string;
  kind: WorkspaceSearchKind;
  label: string;
  hint: string;
  href: string;
};

export const WORKSPACE_SEARCH_MIN_QUERY = 2;
export const WORKSPACE_SEARCH_DEBOUNCE_MS = 250;
export const WORKSPACE_SEARCH_DEFAULT_LIMIT = 12;

const KIND_ORDER: WorkspaceSearchKind[] = [
  "page",
  "person",
  "class",
  "subject",
  "assignment",
  "announcement",
  "event",
];

export const WORKSPACE_SEARCH_KIND_LABELS: Record<WorkspaceSearchKind, string> =
  {
    page: "Pages",
    person: "People",
    class: "Classes",
    subject: "Subjects",
    assignment: "Assignments",
    announcement: "Announcements",
    event: "Events",
  };

export function sanitizeWorkspaceSearchQuery(raw: string): string {
  return raw
    .trim()
    .replace(/[^\p{L}\p{N}@._+\-\s]/gu, "")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

export function matchesWorkspaceSearchQuery(
  haystack: string,
  query: string,
): boolean {
  const normalized = sanitizeWorkspaceSearchQuery(query).toLowerCase();
  if (!normalized) {
    return true;
  }

  return haystack.toLowerCase().includes(normalized);
}

export function toWorkspaceSearchPattern(query: string): string {
  const sanitized = sanitizeWorkspaceSearchQuery(query);
  return `%${sanitized.replace(/[%_]/g, "")}%`;
}

export function filterWorkspacePageItems(
  items: WorkspaceSearchResult[],
  query: string,
  limit = 7,
): WorkspaceSearchResult[] {
  const deduped = dedupeWorkspaceSearchResults(items);
  const normalized = sanitizeWorkspaceSearchQuery(query).toLowerCase();

  if (!normalized) {
    return deduped.slice(0, limit);
  }

  return deduped
    .filter((item) =>
      matchesWorkspaceSearchQuery(
        `${item.label} ${item.hint} ${item.href}`,
        normalized,
      ),
    )
    .slice(0, limit);
}

export function mergeWorkspaceSearchResults(
  localPages: WorkspaceSearchResult[],
  remoteResults: WorkspaceSearchResult[],
  query: string,
  limit = WORKSPACE_SEARCH_DEFAULT_LIMIT,
): WorkspaceSearchResult[] {
  const normalized = sanitizeWorkspaceSearchQuery(query).toLowerCase();
  const merged = dedupeWorkspaceSearchResults([
    ...localPages,
    ...remoteResults,
  ]);

  if (!normalized) {
    return merged.slice(0, limit);
  }

  const ranked = merged
    .map((item, index) => ({
      item,
      index,
      score: scoreWorkspaceSearchResult(item, normalized),
    }))
    .filter((entry) => entry.score > 0)
    .sort(
      (left, right) => right.score - left.score || left.index - right.index,
    );

  return ranked.slice(0, limit).map((entry) => entry.item);
}

export function groupWorkspaceSearchResults(results: WorkspaceSearchResult[]) {
  const grouped = new Map<WorkspaceSearchKind, WorkspaceSearchResult[]>();

  for (const kind of KIND_ORDER) {
    grouped.set(kind, []);
  }

  for (const result of results) {
    const bucket = grouped.get(result.kind) || [];
    bucket.push(result);
    grouped.set(result.kind, bucket);
  }

  return KIND_ORDER.flatMap((kind) => {
    const items = grouped.get(kind) || [];
    if (items.length === 0) {
      return [];
    }

    return [{ kind, label: WORKSPACE_SEARCH_KIND_LABELS[kind], items }];
  });
}

export function buildWorkspaceUsersHref(
  query: string,
  profileId?: string | null,
) {
  const params = new URLSearchParams();
  const sanitized = sanitizeWorkspaceSearchQuery(query);
  if (sanitized) {
    params.set("q", sanitized);
  }
  if (profileId) {
    params.set("profileId", profileId);
  }

  const qs = params.toString();
  return qs ? `/app/admin/users?${qs}` : "/app/admin/users";
}

export function navItemsToWorkspacePages(
  navItems: Array<{ href: string; label: string }>,
): WorkspaceSearchResult[] {
  const seen = new Set<string>();

  return navItems.flatMap((item) => {
    if (seen.has(item.href)) return [];
    seen.add(item.href);

    return [
      {
        id: `page:${item.href}`,
        kind: "page" as const,
        label: item.label,
        hint:
          item.href.replace(/^\//, "").replace(/\//g, " / ") ||
          "Workspace page",
        href: item.href,
      },
    ];
  });
}

export function buildWorkspaceListHref(
  basePath: string,
  query: string,
  extra?: Record<string, string | undefined | null>,
) {
  const params = new URLSearchParams();
  const sanitized = sanitizeWorkspaceSearchQuery(query);
  if (sanitized) {
    params.set("q", sanitized);
  }

  for (const [key, value] of Object.entries(extra || {})) {
    if (value) {
      params.set(key, value);
    }
  }

  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function dedupeWorkspaceSearchResults(results: WorkspaceSearchResult[]) {
  const seen = new Set<string>();
  const deduped: WorkspaceSearchResult[] = [];

  for (const result of results) {
    const key = `${result.kind}:${result.href || result.id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(result);
  }

  return deduped;
}

function scoreWorkspaceSearchResult(
  item: WorkspaceSearchResult,
  query: string,
) {
  const label = item.label.toLowerCase();
  const hint = item.hint.toLowerCase();
  const href = item.href.toLowerCase();

  if (label === query) return 120;
  if (label.startsWith(query)) return 100;
  if (label.includes(query)) return 80;
  if (hint.includes(query)) return 60;
  if (href.includes(query)) return 40;
  return 0;
}
