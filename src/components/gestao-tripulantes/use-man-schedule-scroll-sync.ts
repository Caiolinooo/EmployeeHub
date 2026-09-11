'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Measures the real table width (not the grown flex parent) and mirrors
 * scrollLeft between the top scrollbar and the grid scrollport.
 */
export function useManScheduleScrollSync(contentKey: number | string) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const isSyncingScrollRef = useRef(false);

  const measure = useCallback(() => {
    const root = tableContainerRef.current;
    if (!root) return;
    const table = root.querySelector<HTMLTableElement>('table');
    const width = Math.max(table?.scrollWidth ?? 0, root.scrollWidth);
    setTableScrollWidth((prev) => (prev === width ? prev : width));
  }, []);

  useEffect(() => {
    const root = tableContainerRef.current;
    if (!root) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    const table = root.querySelector('table');
    if (table) ro.observe(table);
    return () => ro.disconnect();
  }, [contentKey, measure]);

  const handleTopScroll = useCallback(() => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    const tableEl = tableContainerRef.current;
    const topEl = topScrollRef.current;
    if (tableEl && topEl) tableEl.scrollLeft = topEl.scrollLeft;
    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  }, []);

  const handleTableScroll = useCallback(() => {
    if (isSyncingScrollRef.current) return;
    isSyncingScrollRef.current = true;
    const tableEl = tableContainerRef.current;
    const topEl = topScrollRef.current;
    if (tableEl && topEl) topEl.scrollLeft = tableEl.scrollLeft;
    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  }, []);

  return {
    tableContainerRef,
    topScrollRef,
    tableScrollWidth,
    handleTopScroll,
    handleTableScroll,
  };
}
