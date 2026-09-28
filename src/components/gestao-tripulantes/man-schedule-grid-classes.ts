/**
 * Shared overflow + sticky model for every Man Schedule grid
 * (GT tab and `/department/man-schedule`).
 *
 * Chrome/Safari ignore `position: sticky` on table cells when `border-collapse: collapse`
 * (Tailwind preflight default). Use `border-separate` + `border-spacing-0` instead.
 * The scrollport must be this wrapper (`overflow-x-scroll overflow-y-auto` + `min-h-0 min-w-0`),
 * not the page. Without `min-w-0`, flex min-width:auto grows to the `w-max` table and
 * `overflow-*` never creates a horizontal scrollport (clipped by body `overflow-x-hidden`).
 */

export const MAN_SCHEDULE_SCROLL_CLASS =
    'man-schedule-scroll flex-1 min-h-0 min-w-0 overflow-x-scroll overflow-y-auto overscroll-contain relative isolate w-full min-h-[360px] touch-scroll max-lg:flex-none max-lg:min-h-[50vh]';

/** Synced top horizontal bar — same width source as the grid (`table.scrollWidth`). */
export const MAN_SCHEDULE_TOP_SCROLL_CLASS =
    'man-schedule-scroll min-w-0 w-full overflow-x-scroll overflow-y-hidden shrink-0 border-b border-gray-200 bg-slate-50/80';

export const MAN_SCHEDULE_TABLE_CLASS =
    'man-schedule-grid w-max min-w-full border-separate border-spacing-0 font-sans text-xs bg-white';

export const MAN_SCHEDULE_THEAD_CLASS = 'sticky top-0 z-40 bg-white';

/** Right edge of the frozen identity pane so timeline cells do not show through. */
export const MAN_SCHEDULE_STICKY_EDGE_CLASS =
    'shadow-[4px_0_8px_-2px_rgba(15,23,42,0.16)]';

export const MAN_SCHEDULE_STICKY_NAME_CLASS = 'man-schedule-sticky-name';
