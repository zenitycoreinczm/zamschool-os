"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";

import { adminApiJson } from "@/lib/admin-browser-api";
import { ws } from "@/lib/workspace/design";
import {
  filterWorkspacePageItems,
  groupWorkspaceSearchResults,
  mergeWorkspaceSearchResults,
  WORKSPACE_SEARCH_DEBOUNCE_MS,
  WORKSPACE_SEARCH_MIN_QUERY,
  type WorkspaceSearchResult,
} from "@/lib/workspace/search";

type WorkspaceGlobalSearchProps = {
  pageItems: WorkspaceSearchResult[];
  placeholder?: string;
  className?: string;
};

export function WorkspaceGlobalSearch({
  pageItems,
  placeholder = "Search pages, people, classes, and more",
  className,
}: WorkspaceGlobalSearchProps) {
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const requestIdRef = useRef(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [remoteResults, setRemoteResults] = useState<WorkspaceSearchResult[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, WORKSPACE_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    const query = debouncedQuery;
    if (query.length < WORKSPACE_SEARCH_MIN_QUERY) {
      // Reset search state synchronously when query is too short
      setRemoteResults([]); // eslint-disable-line react-hooks/set-state-in-effect
      setRemoteError(null);
      setLoadingRemote(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoadingRemote(true);
    setRemoteError(null);

    void adminApiJson<{ data?: WorkspaceSearchResult[] }>(
      `/api/account/workspace-search?q=${encodeURIComponent(query)}`
    )
      .then((payload) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setRemoteResults(Array.isArray(payload?.data) ? payload.data : []);
      })
      .catch((error: unknown) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setRemoteResults([]);
        setRemoteError(error instanceof Error ? error.message : "Search failed");
      })
      .finally(() => {
        if (requestId === requestIdRef.current) {
          setLoadingRemote(false);
        }
      });
  }, [debouncedQuery]);

  const localPageMatches = useMemo(
    () => filterWorkspacePageItems(pageItems, searchQuery),
    [pageItems, searchQuery]
  );

  const mergedResults = useMemo(
    () => mergeWorkspaceSearchResults(localPageMatches, remoteResults, searchQuery),
    [localPageMatches, remoteResults, searchQuery]
  );

  const groupedResults = useMemo(() => groupWorkspaceSearchResults(mergedResults), [mergedResults]);

  const flatItems = useMemo(() => {
    const items: WorkspaceSearchResult[] = [];
    for (const group of groupedResults) {
      for (const item of group.items) {
        items.push(item);
      }
    }
    return items;
  }, [groupedResults]);

  const showDropdown = searchOpen && (searchQuery.trim().length > 0 || mergedResults.length > 0);

  const safeActiveIndex = activeIndex >= 0 && activeIndex < flatItems.length ? activeIndex : -1;

  const handleSelect = useCallback(
    (href: string) => {
      setSearchOpen(false);
      setSearchQuery("");
      setDebouncedQuery("");
      setRemoteResults([]);
      router.push(href);
    },
    [router]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        return;
      }
      if (!showDropdown || flatItems.length === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % flatItems.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => (prev <= 0 ? flatItems.length - 1 : prev - 1));
      } else if (event.key === "Enter" && activeIndex >= 0 && flatItems[activeIndex]) {
        event.preventDefault();
        handleSelect(flatItems[activeIndex].href);
      }
    },
    [showDropdown, flatItems, activeIndex, handleSelect]
  );

  const inputId = "workspace-search-input";

  return (
    <div
      ref={searchRef}
      className={className || `relative min-w-0 flex-1 max-w-[360px] ${ws.headerActions}`}
    >
      <div className="flex items-center gap-2 rounded-full border border-workspace-border bg-white px-3 py-2 shadow-workspace-xs transition-shadow focus-within:shadow-workspace-focus">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          id={inputId}
          value={searchQuery}
          placeholder={placeholder}
          onFocus={() => setSearchOpen(true)}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setActiveIndex(-1);
            setSearchOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent text-sm text-slate-600 outline-none"
          aria-label="Workspace search"
          aria-expanded={showDropdown}
          aria-controls="workspace-search-results"
          aria-activedescendant={safeActiveIndex >= 0 ? `search-result-${flatItems[safeActiveIndex]?.kind}-${flatItems[safeActiveIndex]?.id}` : undefined}
          role="combobox"
          aria-autocomplete="list"
          autoComplete="off"
        />
        {loadingRemote ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-300" /> : null}
      </div>

      {showDropdown ? (
        <div
          id="workspace-search-results"
          role="listbox"
          aria-label="Search results"
          className={`absolute inset-x-0 top-full mt-2 overflow-hidden rounded-workspace-xl border border-workspace-border bg-white shadow-workspace-lg ${ws.popover}`}
        >
          <div className="border-b border-slate-100 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Search results
          </div>
          <div className="max-h-[360px] overflow-y-auto p-2">
            {remoteError ? (
              <div className="rounded-2xl px-3 py-3 text-sm text-amber-700" role="alert">{remoteError}</div>
            ) : null}

            {mergedResults.length === 0 ? (
              <div className="rounded-2xl px-3 py-6 text-center text-sm text-slate-500">
                {debouncedQuery.length >= WORKSPACE_SEARCH_MIN_QUERY && loadingRemote
                  ? "Searching workspace…"
                  : debouncedQuery.length >= WORKSPACE_SEARCH_MIN_QUERY
                    ? "No matches found."
                    : "Type at least 2 characters to search people and records."}
              </div>
            ) : (
              groupedResults.map((group) => (
                <div key={group.kind} role="group" aria-label={group.label}>
                  <p
                    className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400"
                    role="presentation"
                  >
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const globalIdx = flatItems.indexOf(item);
                    const isActive = globalIdx === safeActiveIndex;
                    const optionId = `search-result-${item.kind}-${item.id}`;
                    return (
                      <button
                        key={`${item.kind}-${item.id}`}
                        id={optionId}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        onClick={() => handleSelect(item.href)}
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                        className={`flex w-full items-start justify-between rounded-2xl px-3 py-3 text-left transition ${isActive ? "bg-slate-100" : "hover:bg-slate-50"}`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                          <p className="mt-1 text-xs text-slate-400">{item.hint}</p>
                        </div>
                        <span className="text-[11px] uppercase tracking-[0.12em] text-slate-300">Open</span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
