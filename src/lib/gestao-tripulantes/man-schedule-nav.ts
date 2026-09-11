export const MAN_SCHEDULE_COL_ATTR = 'data-man-schedule-col';
export const MAN_SCHEDULE_STICKY_END_ATTR = 'data-man-schedule-sticky-end';

export function adjacentColumnIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(length - 1, current + delta));
}

function canScrollX(el: HTMLElement): boolean {
  const { overflowX } = window.getComputedStyle(el);
  const scrollable = overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'overlay';
  return scrollable && el.scrollWidth > el.clientWidth + 1;
}

export function findHorizontalScrollParent(el: HTMLElement | null): HTMLElement | null {
  if (!el || typeof window === 'undefined') return el;
  let node: HTMLElement | null = el;
  while (node) {
    if (canScrollX(node)) return node;
    node = node.parentElement;
  }
  return el;
}

export function readVisibleColumnIndex(root: HTMLElement): number {
  const cols = root.querySelectorAll<HTMLElement>(`[${MAN_SCHEDULE_COL_ATTR}]`);
  if (cols.length === 0) return 0;
  const sticky = root.querySelector<HTMLElement>(`[${MAN_SCHEDULE_STICKY_END_ATTR}]`);
  const threshold = (sticky?.getBoundingClientRect().right ?? root.getBoundingClientRect().left) + 2;
  for (const col of cols) {
    if (col.getBoundingClientRect().right > threshold + 4) {
      const idx = Number(col.getAttribute(MAN_SCHEDULE_COL_ATTR));
      return Number.isFinite(idx) ? idx : 0;
    }
  }
  const last = Number(cols[cols.length - 1].getAttribute(MAN_SCHEDULE_COL_ATTR));
  return Number.isFinite(last) ? last : 0;
}

export function scrollScheduleColumnIntoView(root: HTMLElement, index: number): boolean {
  const col = root.querySelector<HTMLElement>(`[${MAN_SCHEDULE_COL_ATTR}="${index}"]`);
  if (!col) return false;

  const scroller = findHorizontalScrollParent(root);
  if (scroller && canScrollX(scroller)) {
    const sticky = root.querySelector<HTMLElement>(`[${MAN_SCHEDULE_STICKY_END_ATTR}]`);
    const stickyRight = sticky
      ? sticky.getBoundingClientRect().right
      : scroller.getBoundingClientRect().left;
    const delta = col.getBoundingClientRect().left - stickyRight;
    if (Math.abs(delta) >= 1) {
      scroller.scrollBy({ left: delta, behavior: 'smooth' });
    }
    return true;
  }

  col.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  return true;
}
