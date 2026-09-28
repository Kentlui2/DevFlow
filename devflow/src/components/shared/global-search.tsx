"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SearchResult = { id: string; label: string; detail: string; href: string };

export function GlobalSearch() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  function open() {
    dialogRef.current?.showModal();
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!dialogRef.current?.open) open();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error("Search failed");
        const payload = (await response.json()) as { data: SearchResult[] };
        setResults(payload.data);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  return (
    <>
      <Button
        aria-label="Search workspace"
        className="text-muted-foreground gap-2 px-2 sm:px-3"
        onClick={open}
        type="button"
        variant="outline"
      >
        <Search aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="bg-muted hidden rounded px-1.5 py-0.5 text-[10px] font-normal sm:inline">
          ⌘ / Ctrl K
        </kbd>
      </Button>
      <dialog
        aria-labelledby="workspace-search-title"
        className="bg-background text-foreground fixed inset-0 m-auto max-h-[min(80vh,40rem)] w-[min(38rem,calc(100vw-2rem))] overflow-hidden rounded-xl border p-0 shadow-xl backdrop:bg-black/40"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
        onClose={() => {
          setQuery("");
          setResults([]);
          setLoading(false);
          setError(false);
        }}
        ref={dialogRef}
      >
        <h2 className="sr-only" id="workspace-search-title">
          Search your workspace
        </h2>
        <label className="flex items-center gap-3 border-b px-4">
          <Search
            aria-hidden="true"
            className="text-muted-foreground size-5 shrink-0"
          />
          <span className="sr-only">
            Search projects, tasks, issues, and members
          </span>
          <Input
            autoComplete="off"
            className="h-14 border-0 px-0 shadow-none focus-visible:ring-0"
            onChange={(event) => {
              setQuery(event.target.value);
              setResults([]);
              setLoading(false);
              setError(false);
            }}
            placeholder="Search projects, tasks, issues, and members…"
            ref={inputRef}
            value={query}
          />
          <button
            aria-label="Close search"
            className="text-muted-foreground hover:bg-accent rounded border px-2 py-1 text-xs"
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            Esc
          </button>
        </label>
        <div
          aria-live="polite"
          className="max-h-[calc(min(80vh,40rem)-3.5rem)] overflow-y-auto p-2"
        >
          {query.trim().length < 2 ? (
            <p className="text-muted-foreground px-3 py-8 text-center text-sm">
              Type at least 2 characters to search.
            </p>
          ) : null}
          {loading ? (
            <p className="text-muted-foreground px-3 py-8 text-center text-sm">
              Searching your workspace…
            </p>
          ) : null}
          {error ? (
            <p className="text-destructive px-3 py-8 text-center text-sm">
              Search couldn’t load. Try again.
            </p>
          ) : null}
          {!loading &&
          !error &&
          query.trim().length >= 2 &&
          results.length === 0 ? (
            <p className="text-muted-foreground px-3 py-8 text-center text-sm">
              No matches found.
            </p>
          ) : null}
          {!loading && results.length ? (
            <ul aria-label="Search results" className="space-y-1">
              {results.map((result) => (
                <li key={result.id}>
                  <Link
                    className="hover:bg-accent focus-visible:bg-accent flex items-center justify-between gap-4 rounded-md px-3 py-3 focus-visible:outline-none"
                    href={result.href}
                    onClick={() => dialogRef.current?.close()}
                  >
                    <span className="min-w-0 truncate text-sm font-medium">
                      {result.label}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {result.detail}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
