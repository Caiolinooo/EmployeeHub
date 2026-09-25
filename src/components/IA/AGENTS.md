# Companion UI — DOX

## Purpose

Componentes React do Companion FAB / chat IA (`AnimatedABZLogo`, mascote, bolhas Markdown).

## Ownership

- `AnimatedABZLogo.tsx` — API pública (status / size / className / visemeIndex); float/aura + prefetch; delega ao runtime
- `CompanionMascotRive.tsx` — gate Rive vs Rive-like
- `CompanionMascotRiveLike.tsx` — sprite SM body crossfade (face overlay gated off)
- `CompanionMascotRivePlayer.tsx` — runtime `@rive-app/react-canvas-lite` (lazy)
- `companion-mascot-frames.ts` — body maps, cycles, Rive SM contract, `MASCOT_USE_FACE_OVERLAY`
- `companion-mascot-rive-probe.ts` — HEAD probe de `/rive/companion-mascot.riv`
- `companion-logo-motion.ts` — float/aura/radar por status (calm amplitudes)
- `AICompanionWidget.tsx` — FAB + session UI; status semantics for mascot
- `chatMarkdown.tsx` — renderer Markdown das bolhas IA (GFM tables, blockquotes, listas, headings; só React nodes)
- `MessageBubble.tsx` — bolha do Assistant `/ia` (usa `chatMarkdown`)

## Local Contracts

- Status: `idle` | `listening` | `speaking` | `executing`
- **Semantics**: API wait / tools → `executing` (calm think poses). `speaking` only for real speech/TTS — never lip-sync spam during HTTP wait
- Body assets: `public/images/companion-mascot/body/` (+ optional `face/` for future blank-face cutouts)
- **Body-only default**: `MASCOT_USE_FACE_OVERLAY = false` — body PNGs already have faces; overlays cause gray skull / double-face
- Rive: `public/rive/companion-mascot.riv` — SM `CompanionSM`, Number `status` (0–3) + `viseme` (0–3, no-op visually). Opacity crossfades + float-idle; soft SM mixes ~500ms; 17 body poses (exec parity with Rive-like)
- Prefetch: body PNGs only while `MASCOT_USE_FACE_OVERLAY=false` (no unused face warm)
- Bones prep (Editor): `docs/assets/companion-mascot/cutouts/` — not a finished bone-skinned riv
- Regenerar: `scratch/build-companion-mascot-riv.mjs` via `rive-mcp-server` createRiv (não vendorar o server)
- Sem `.riv` / load error → `CompanionMascotRiveLike`
- `prefers-reduced-motion` → estático
- Tamanhos FAB 60 / header 36 / hero 80
- Overlays do chat IA (`ChatWindow` sidebar mobile, `ExchangeIntegrationModal`, `VoiceAssistantModal`): X `data-modal-close` ≥44×44, Esc, toque fora. CSS só ≤767 / `max-md`. Desktop 0 px.
- Não quebrar FAB `fixed`, session provider ou `portal-action-bus`
- **Markdown das bolhas** (`renderChatMarkdown`): tabelas GFM (`| col |` + delimiter row) → `<table>` real com `overflow-x-auto`; `> ` → callout; listas bullet/numeradas com hanging indent (níveis por indentação; `- **Título**: desc` vira linha estruturada); headings `#`–`####`; `---` → hr; código fenced/inline mantido; links sanitizados (http/https/mailto/relativo) — **nunca** `dangerouslySetInnerHTML`
- Bolhas **não** usam `prose` (Tailwind typography) — o renderer controla toda a tipografia; bolha Assistant `w-fit max-w-full min-w-0` para tabelas rolarem dentro

## Work Guidance

- Preferir trocar body PNGs / retunes em `MASCOT_STATUS_CYCLES` a overlays de face
- Só reativar face overlay com corpos blank-face + cutouts alpha verdadeiros
- Motion docs: `public/rive/README.md`
- Manter `@rive-app/react-canvas-lite` só no player lazy

## Verification

- Idle: body crossfade + bob; sem boca/ghost overlay
- Send message → `executing` (think), not epileptic visemes
- `prefers-reduced-motion` → estático
- FAB open/close + send message sem regressão de session/bus
- `npx tsx --test src/components/chat/chat-modals.mobile-chrome.test.ts`

## Child DOX Index

_(none)_
