# Spike 2026: cloud/local image-to-3D for Companion book mascot — **NO-GO**

Date: 2026-07-28  
Branch: `portal`  
Verdict: **NO-GO** for production animation / bones.  
Quality carrier stays: **Fase 0 compositor + Rive** (`companion-mascot.riv` / keyed body PNGs).  
**Runtime should not wait for 3D.**

Related prior spike: [`../3d/SPIKE.md`](../3d/SPIKE.md) (local TripoSR — also NO-GO).

## Env / keys

Checked `.env`, `.env.local`, and process env for `MESHY_*`, `TRIPO_*`, `LUMA_*`, `RODIN*`, `CSM*`, `FAL_*`, `REPLICATE_*`, `HF_*`.

**Result: no image-to-3D API keys present.** Cloud Meshy / Tripo / Rodin / Luma / CSM were **not** callable via paid API from this machine.

## What we generated (this spike)

| Item | Detail |
|------|--------|
| Input | `public/images/companion-mascot/body/idle_stand.png` → white-composite `input-idle_stand_clean.png` |
| Free gen (no key) | Hugging Face Space **`tencent/Hunyuan3D-2`** `/shape_generation` |
| Output mesh | `hunyuan3d2-shape-white_mesh.glb` (~4.1 MB, **77 256 verts / 266 272 faces**) |
| Texture pass | `/generation_all` **failed** on Space (`NameError` server-side) — **no textured/face GLB** |
| Previews | `previews/{front,side,rear}.png` (local orthographic raster; shape-only) |
| Log | `generation-log.json` |
| Scratch | `scratch/image-to-3d/spike_hf_generate.py`, `render_glb_previews.py` |

Also on disk (prior): `../3d/companion-mascot-triposr.glb` for comparison.

### Mesh metrics (honest)

| Mesh | Verts / faces | Extents (X/Y/Z) | Watertight | UV / texture |
|------|---------------|-----------------|------------|--------------|
| Hunyuan3D-2 shape | 77k / 266k | ~1.30 / 1.96 / **0.28** (book-thin) | No | No |
| TripoSR (prior) | 20k / 41k | ~0.93 / 0.62 / **0.44** (too thick) | Yes | Soft vertex color only |

Hunyuan gets **book thickness** closer to a real hardcover than TripoSR. That is still not enough for ship.

## Honest quality read (production bar)

Bar for GO: front **and** side read as blue book mascot; **limbs** separable for bones; **face** and **cover text/logo** readable or cleanly texture-mapped; topology usable for light rig (idle / listen / speak / exec).

| Check | Hunyuan shape (this run) | Notes |
|-------|--------------------------|-------|
| Limbs | **Weak** | Stubby arms/legs exist; stick-thin cartoon limbs collapse; not bone-ready |
| Face | **Fail** | Shape-only white mesh; no eyes/mouth geometry or texture |
| Book readable | **Fail** | No cover text/logo; no page edge readability |
| Side / rear | **Partial** | Thin slab better than TripoSR smear, still soft edges + fused feet |
| Rig / bones | **Fail** | Dense non-watertight soup; no clean joint loops |

**Does it beat Fase 0 2D sprites for FAB animation?** No. Baking poses from this would regress vs `public/images/companion-mascot/body/`.

## Service landscape (research, not all executed)

| Service | Role for stylized chars | Export (claimed) | This spike |
|---------|-------------------------|-----------------|------------|
| **Meshy** (6) | Strong all-in-one; multi-view; auto-rig / animation tooling; free ~100 credits/mo (account) | GLB, FBX, OBJ, USDZ, STL, BLEND, 3MF | **Not run** — no key; free tier needs account |
| **Tripo** | Image/multi-view → mesh + rigging path; free Basic credits (account/API key) | GLB / FBX / OBJ / STL | **Not run** — no `TRIPO_*`; API needs `tsk_…` |
| **Hyper3D Rodin** | Higher raw geometry; multi-view; less animation toolkit | GLB, FBX, OBJ, STL, USDZ (via fal/WaveSpeed) | **Not run** — needs fal/Rodin billing |
| **Hunyuan3D-2** (HF Space) | Solid open/cloud shape draft | GLB (+ export OBJ/PLY/STL on Space) | **Ran** shape — still NO-GO |
| **TripoSR** (local + prior) | Fast single-image draft | GLB | Prior NO-GO blob sides |
| **Luma Genie** | Text/image→3D historically | — | **Sunset / not a production path** (reports: Genie sunsetting Jan 2026; focus → Dream Machine video) |
| **CSM** (Common Sense Machines) | Image/text/video→3D; free trial + paid | GLB/FBX/OBJ/USDZ (varies) | **Not run** — account/API; complex chars still hard |
| **Sculptor / SculptChat** | Print-oriented image→STL/GLB | STL, GLB | **Not run** — wrong fit for rigged mascot FAB |

Sources consulted during spike (web): [Meshy Image to 3D](https://www.meshy.ai/features/image-to-3d), [Tripo free image-to-3D](https://www.tripo3d.ai/features/image-to-3d-model/free), [fal Hyper3D Rodin](https://fal.ai/models/fal-ai/hyper3d/rodin), [Meshy vs Rodin](https://www.modelspawner.com/blog/meshy-vs-hyper3d), [CSM review](https://en.ai-pedias.com/tools/csm-ai), [Hunyuan3D-2 Space](https://huggingface.co/spaces/tencent/Hunyuan3D-2).

## If someone revisits (only if GO candidate appears)

1. Add **Meshy** or **Tripo** API key (or paid multi-view session) with **front + side + 3/4** orthographic refs (not single frontal alone).
2. Require textured export that shows **face + cover** clearly; then remesh / Auto-Rig (Meshy) or manual bones in Blender; export **GLB** (web) + **FBX** (DCC).
3. Pass bar: side view still reads as book; limbs animate without webbing; cover identity preserved.
4. Until then: **do not** wire GLB into Companion FAB; keep Rive / Fase 0.

## Runtime impact

- **Do not wait for 3D** in Companion animation roadmap.
- `AnimatedABZLogo` / Rive path unchanged (this spike did not touch runtime).
- Artifacts here are **evidence only**, not production assets.

## Artifacts

```
docs/assets/companion-mascot/3d-spike-2026/
  SPIKE.md                          ← this file
  input-idle_stand_clean.png
  input-idle_stand_512.png          ← prior TripoSR prep copy
  hunyuan3d2-shape-white_mesh.glb
  generation-log.json
  spike-meta.json
  previews/front.png | side.png | rear.png
```

Commit policy: NO-GO → keep SPIKE + evidence local or commit **doc-only** if desired; do **not** promote mesh into `public/` or Companion runtime.
