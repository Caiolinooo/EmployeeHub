/** Tokens do front mobile. String — sem `import '*.css'` (isso entra no CSS global e reordena next/font). */
export const MOBILE_SURFACE_CSS = `
[data-abz-ui='mobile'] {
  --touch-min: 44px;
  --mobile-nav-h: 64px;
  --mobile-blue: #005b96;
  --mobile-bg: #f3f6fb;
  font-size: 16px;
}

[data-abz-ui='mobile'] .touch-target {
  min-width: var(--touch-min);
  min-height: var(--touch-min);
}

[data-abz-ui='mobile'] .abz-m-bg { background: var(--mobile-bg); }
[data-abz-ui='mobile'] .abz-m-dialog { position: fixed; inset: 0; z-index: 80; }
[data-abz-ui='mobile'] .abz-m-scrim { position: absolute; inset: 0; background: rgba(0,0,0,0.45); }
[data-abz-ui='mobile'] .abz-m-sheet {
  max-height: 85dvh;
  border-top-left-radius: 1.5rem;
  border-top-right-radius: 1.5rem;
}
[data-abz-ui='mobile'] .abz-m-sheet-tall { height: 85dvh; }
[data-abz-ui='mobile'] .abz-m-nav {
  min-height: var(--mobile-nav-h);
  height: auto;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
[data-abz-ui='mobile'] .abz-m-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: var(--touch-min);
  min-height: var(--touch-min);
  padding: 6px 4px;
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  background: transparent;
}
[data-abz-ui='mobile'] .abz-m-nav-item-active {
  color: var(--mobile-blue);
  box-shadow: inset 0 3px 0 var(--mobile-blue);
}
[data-abz-ui='mobile'] .abz-m-main {
  padding-bottom: calc(var(--mobile-nav-h) + env(safe-area-inset-bottom, 0px) + 16px);
}
[data-abz-ui='mobile'] .abz-m-fab {
  position: fixed;
  right: 1rem;
  bottom: calc(var(--mobile-nav-h) + env(safe-area-inset-bottom, 0px) + 12px);
}
[data-abz-ui='mobile'] .abz-m-chip { background: #e8f1f8; }
[data-abz-ui='mobile'] .abz-m-card { min-height: 64px; }
[data-abz-ui='mobile'] .abz-m-carousel {
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(2, auto);
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  margin-inline: -1rem;
  padding: 2px 1rem 6px;
}
[data-abz-ui='mobile'] .abz-m-carousel::-webkit-scrollbar { display: none; }
[data-abz-ui='mobile'] .abz-m-carousel-card {
  scroll-snap-align: start;
  width: 44vw;
  max-width: 176px;
}
[data-abz-ui='mobile'] .abz-m-switch { bottom: 12px; }
[data-abz-ui='mobile'] .abz-m-alert-error { background: #fef2f2; color: #b91c1c; }
[data-abz-ui='mobile'] .abz-m-alert-ok { background: #f0fdf4; color: #166534; }
`.trim();
