import { useEffect, useRef } from "react";

/**
 * Wires up "the reader reached the end of this paged list". Attach the returned
 * ref to a sentinel element rendered after the last row; whenever it scrolls
 * into view inside its scroll container, `onLoadMore` runs.
 *
 * While `enabled` is false the observer is never attached, so a list that has
 * been paged to the end does not fire a no-op request on every pixel scrolled.
 * `onLoadMore` is read through a ref, so an inline arrow function does not tear
 * the observer down and rebuild it on every render.
 */
export function usePagedScroll(onLoadMore: () => void, enabled: boolean) {
  const sentinel = useRef<HTMLDivElement | null>(null);
  const loadMore = useRef(onLoadMore);
  loadMore.current = onLoadMore;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !enabled || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore.current();
      },
      // Intersecting against the viewport, clipped by the scroll ancestor, is
      // exactly "the sentinel is on screen inside the list".
      { rootMargin: "0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return sentinel;
}
