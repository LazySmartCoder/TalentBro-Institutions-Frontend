import { useCallback, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { usePagedScroll } from "@/lib/use-paged-scroll";

/**
 * Rows a self-training history screen requests per page.
 *
 * A student who practises a module weekly accumulates sessions without bound, so
 * every history list is pulled a page at a time rather than in one response.
 * 50 is deliberately generous: the point is to bound transfer and parse cost on
 * a long record, not to make the reader click through many tiny pages.
 */
export const HISTORY_PAGE_SIZE = 50;

/** The paged shape every self-training history endpoint returns. */
export type HistoryPage<T, TRollup = never> = {
  sessions: T[];
  has_more: boolean;
  total: number;
  offset: number;
  limit: number;
  /**
   * Whole-record aggregates, present only on the endpoints whose page shows a
   * summary panel. Every page carries the same values, so a summary stays put
   * while later pages load.
   */
  summary?: HistorySummary;
  /**
   * A compact projection of every session, present only on the endpoints whose
   * UI derives cross-session figures client-side. Same reasoning: the derivation
   * needs the whole record, and the page only carries the visible window of it.
   *
   * The row shape differs per module, so each list endpoint declares its own.
   */
  rollup?: TRollup[];
};

/** Averages and first-to-latest trend across every analysed session. */
export type HistorySummary = {
  analyzed_count: number;
  overall: number;
  best: number;
  latest: number;
  first: number;
  last_practiced_at: string | null;
  averages: Record<string, number>;
  total_mistakes?: number;
};

/**
 * The five fields the APLR, Basic Math, DSA, Situational and Technical screens
 * read to build their stats and category insights, for every session in the
 * record rather than only the loaded page.
 */
export type PracticeRollupRow = {
  status: string;
  points_awarded: number;
  star_rating: number;
  category: string;
  created_at: string;
};

/** One score per saved GD round, for the report's whole-record progress line. */
export type GdRollupRow = {
  overall_score: number | null;
  created_at: string;
};

type PagedHistoryOptions<T, TRollup = never> = {
  queryKey: readonly unknown[];
  /** Fetches one page. Must be stable across renders: module scope or useCallback. */
  queryFn: (params: { limit: number; offset: number }) => Promise<HistoryPage<T, TRollup>>;
};

/**
 * The query + scroll-sentinel pair every paged history screen needs, so each one
 * is a few lines at the call site rather than a copy of the whole pattern.
 *
 * `pageParam` is a running row offset rather than a page index, so a page that
 * comes back short (rows deleted since the last fetch) still leaves the next
 * window in the right place.
 */
export function usePagedHistoryList<T, TRollup = never>({
  queryKey,
  queryFn,
}: PagedHistoryOptions<T, TRollup>) {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => queryFn({ limit: HISTORY_PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.has_more ? all.length * HISTORY_PAGE_SIZE : undefined),
  });

  const sessions = useMemo(
    () => query.data?.pages.flatMap((page) => page.sessions) ?? [],
    [query.data],
  );
  // Every page returns the same whole-record summary and rollup, so reading them
  // off the first page is enough and neither shifts when more rows arrive.
  const summary = query.data?.pages[0]?.summary;
  const rollup = query.data?.pages[0]?.rollup;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Attach to a row rendered after the last one. The observer stays attached
  // while the server still reports more pages, and goes inert once it does not.
  const listEnd = usePagedScroll(loadMore, hasNextPage !== false);

  return { ...query, sessions, summary, rollup, listEnd };
}

type PagedHistoryStateOptions<T, TRollup> = {
  /** Fetches one page. Must be stable across renders: module scope or useCallback. */
  queryFn: (params: { limit: number; offset: number }) => Promise<HistoryPage<T, TRollup>>;
};

/**
 * The same paging behaviour for pages that already keep their session list in
 * local state and refresh it imperatively.
 *
 * The APLR, Basic Math, DSA, Situational and Technical screens reload their list
 * after every answer, so they cannot hand the list to a query cache. This hook
 * gives them paging without changing that flow: `refresh` replaces the list and
 * is what those screens call after an action, `loadMore` appends the next page,
 * and the sentinel ref is attached to the end of the history list.
 */
export function usePagedHistoryState<T, TRollup = never>({
  queryFn,
}: PagedHistoryStateOptions<T, TRollup>) {
  const [sessions, setSessions] = useState<T[]>([]);
  const [rollup, setRollup] = useState<TRollup[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Read inside `loadMore` without making the callback depend on `sessions`, so
  // the sentinel ref stays stable across renders.
  const offsetRef = useRef(0);

  const applyPage = useCallback((page: HistoryPage<T, TRollup>) => {
    setSessions(page.sessions);
    setRollup(page.rollup ?? []);
    setHasMore(page.has_more);
    offsetRef.current = page.sessions.length;
  }, []);

  /** Replace the list with the newest page. Returns it so callers can read it. */
  const refresh = useCallback(async (): Promise<T[]> => {
    const page = await queryFn({ limit: HISTORY_PAGE_SIZE, offset: 0 });
    applyPage(page);
    return page.sessions;
  }, [queryFn, applyPage]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await queryFn({ limit: HISTORY_PAGE_SIZE, offset: offsetRef.current });
      setSessions((prev) => [...prev, ...page.sessions]);
      setHasMore(page.has_more);
      offsetRef.current += page.sessions.length;
    } finally {
      setIsLoadingMore(false);
    }
  }, [queryFn, isLoadingMore]);

  const onSentinel = useCallback(() => {
    if (hasMore && !isLoadingMore) void loadMore();
  }, [hasMore, isLoadingMore, loadMore]);

  const listEnd = usePagedScroll(onSentinel, hasMore);

  return { sessions, rollup, hasMore, isLoadingMore, refresh, loadMore, listEnd };
}
