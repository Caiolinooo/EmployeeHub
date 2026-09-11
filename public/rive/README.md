# Companion mascot — Rive drop-in

```
public/rive/companion-mascot.riv
```

Served as `/rive/companion-mascot.riv`.

`AnimatedABZLogo` → `CompanionMascotRive` probes this path (HEAD, then ranged GET). When present, the app lazy-loads `@rive-app/react-canvas-lite`. If missing or load fails → **CompanionMascotRiveLike** (sprite fallback).

## Required state machine contract

| Item | Value |
|------|--------|
| State machine name | `CompanionSM` |
| Input `status` (Number) | `0` idle · `1` listening · `2` speaking · `3` executing |
| Input `viseme` (Number) | `0`–`3` reserved (no-op visually in body-only build) |

## Motion design (v5.58+)

**Body-only.** Body PNGs already include faces. Face/viseme image overlays are **not** embedded — stacking them caused a gray skull / double-face artifact.

| Layer | Behavior |
|-------|----------|
| Status | Opacity crossfades between keyed body poses + `float-idle` / sway / breathing on `root` |
| Status mixes | **~500ms** SM blend (`durationMs`) — no hard solo snaps |
| Viseme | Contract input only; mouth variation comes from `speak_*` body frames |
| Idle | Stand / wave / alt with hold+fade **≥2.5s** per step + calm float-idle (~5s cycle) |
| Listening | Ear / tilt / point poses + soft sway |
| Speaking | Soft speak body cycle (open/grin/active/gesture) — use only for real speech/TTS |
| Executing | Think / bulb / type / **point / read / stretch** — **API wait / portal work** (calm, no lip-sync) |

Bones / mesh deformation: prep cutouts in `docs/assets/companion-mascot/cutouts/` — human Editor still required.

### Status semantics (React)

- **executing** — waiting on `/api/ia/companion` or running portal commands (thinking pose)
- **speaking** — reserved for actual speech / TTS (not the HTTP wait)
- **listening** — mic / voice mode
- **idle** — rest

Fake lip-sync is off for body-only; never drive epileptic viseme spam on idle.

### Regenerate

```bash
# one-time tool install (scratch only; not a product dependency)
cd scratch/rive-gen && npm install rive-mcp-server@0.4.1

# from repo root
node scratch/build-companion-mascot-riv.mjs
node scratch/validate-companion-mascot-riv.mjs   # needs Chrome/Edge; sets RIVE_MCP_CHROME if needed
```

License note: `rive-mcp-server` freeware allows unlimited use of **generated** `.riv` output; redistributing the MCP server itself is prohibited — keep it out of git.

## Designer / Editor path (optional upgrade)

1. Prefer cutout layers in `docs/assets/companion-mascot/cutouts/` (see README there) or full bodies under `public/images/companion-mascot/body/`.
2. Keep SM **CompanionSM** + Number inputs `status` / `viseme`.
3. Prefer bones / longer holds / blend (≥500ms status mixes) — never opaque face overlays on faced bodies.
4. Export optimized `.riv` over this file; validate with `node scratch/validate-companion-mascot-riv.mjs`.

## Notes

- Prefer quality: calm crossfades beat dense flipbooks.
- `prefers-reduced-motion` freezes on the sprite fallback (never autoplays Rive).
- Face overlay path in React is gated by `MASCOT_USE_FACE_OVERLAY` (default `false`).
