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
[data-abz-ui='mobile'] .abz-m-nav { height: var(--mobile-nav-h); }
[data-abz-ui='mobile'] .abz-m-main { padding-bottom: calc(var(--mobile-nav-h) + 16px); }
[data-abz-ui='mobile'] .abz-m-fab {
  position: fixed;
  right: 1rem;
  bottom: calc(var(--mobile-nav-h) + 12px);
}
[data-abz-ui='mobile'] .abz-m-chip { background: #e8f1f8; }
[data-abz-ui='mobile'] .abz-m-card { min-height: 64px; }
[data-abz-ui='mobile'] .abz-m-switch { bottom: 12px; }
`.trim();
