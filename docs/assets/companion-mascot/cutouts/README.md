# Companion mascot — bone cutout prep (human Editor)

**Status:** automation prep only. These PNGs are **not** a finished bone-skinned `.riv`.

True quality upgrade (mesh deformation / IK) requires a human in the **Rive Editor** placing bones on separable layers. Agents cannot fully replace that.

## What’s here

| File | Role |
|------|------|
| `idle_stand_source.png` | Source frame (`public/images/companion-mascot/body/idle_stand.png`) |
| `book_core.png` | Book body + face + cover art (keep face painted here) |
| `arm_left.png` / `arm_right.png` | Best-effort stick-arm cutouts |
| `leg_left.png` / `leg_right.png` | Best-effort stick-leg cutouts |
| `cutout_regions_preview.png` | Visual check of regions |
| `cutout-meta.json` | Opaque bboxes + pixel counts |

Regenerate:

```bash
python scratch/generate_mascot_cutouts.py
```

## Rive Editor hierarchy (recommended)

1. New artboard **128×128**, name `Companion`.
2. Import layers above; align to same canvas origin.
3. Bone tree (suggested):
   - `root`
   - `spine` → weight `book_core` (pivot near book center)
   - `arm_L` / `arm_R` → children of `spine`
   - `leg_L` / `leg_R` → children of `spine`
4. Keep state machine contract:
   - SM name: `CompanionSM`
   - Number `status` 0 idle / 1 listening / 2 speaking / 3 executing
   - Number `viseme` 0–3 (may remain visual no-op)
5. Prefer soft mixes **≥500ms** between status states; idle pose step **≥2.5s**.
6. **Do not** reintroduce face/viseme image overlays on faced bodies (`MASCOT_USE_FACE_OVERLAY` stays false).
7. Export optimized `.riv` → `public/rive/companion-mascot.riv`, then:

```bash
node scratch/validate-companion-mascot-riv.mjs
```

## Quality gate reminder

Ship only if FAB 60 stays readable, `.riv` not ≫600KB without a clear win, reduced-motion static, no double-face, API wait = `executing`.

## Related

- Runtime body-only riv: `public/rive/README.md`
- 3D path: **NO-GO** — see `../3d-spike-2026/SPIKE.md`
