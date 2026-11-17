# ATTRIBUTION & PROVENANCE

Ember Wing is an original game. This file documents the provenance of every non-original byte in the tree.

## AI-generated media — `game/assets/v6/`

All six images in `game/assets/v6/` are AI-generated from text prompts with **FLUX.1-schnell**
(Black Forest Labs, `black-forest-labs/FLUX.1-schnell`), licensed under the **Apache License 2.0**,
whose generated outputs impose no usage restriction. Images were produced on 2026-11-17 via the
private Kaggle kernel `jacquotvelomanana/ember-wing-flux-assets-v1`. No post-processing, compositing,
or editing beyond a hard black clamp on VFX corners. Generation prompts, verbatim, for the record:

| File | Prompt |
|---|---|
| `nebula-sky.jpg` | "Vast deep space nebula, near-black background, deep violet and magenta clouds, faint ember-orange core glow far away, scattered tiny stars, cinematic, painterly, no text, atmospheric depth, ultra dark edges" |
| `far-city.jpg` | "Distant ruined city skyline silhouette on pure black background, spindly gothic towers, broken antennae, faint ember-orange window specks, lone burning skeleton tower left of center, thin neon haze on horizon, panoramic, dark, painterly, high contrast silhouette, no text" |
| `hollow-crown-boss.jpg` | "Terrifying ornate dark crown boss entity with spiked wings, central glowing magenta void eye, symmetric frontal view, violet and magenta flames, intricate black metal crown with purple jewels, pure black background, screen blend sprite, painterly, highly detailed, no text" |
| `glass-manta.jpg` | "Translucent glass manta ray alien war machine, iridescent cyan and magenta wing membranes, delicate glowing veins, frontal view, pure black background, painterly, high detail, no text" |
| `fx-detonation.jpg` | "Massive plasma detonation fireball, radial shockwave, white-hot core, orange and magenta flames, electric arcs, tiny embers, pure black background, screen blend VFX sprite, painterly, no text" |
| `fx-muzzle-nova.jpg` | "Radiant energy muzzle blast ring, expanding cyan-white plasma circle with glowing rim and inner rays, tiny sparks, pure black background, screen blend VFX sprite, painterly, no text" |

Earlier iterations of `fx-*.jpg` (generated with SDXL-Turbo, non-commercial license) were **replaced**
by the Apache-2.0 FLUX.1 outputs above.

## Fonts — `game/assets/fonts/`

- **Monoton** — The Monoton Project Authors — SIL Open Font License 1.1 — see `OFL-monoton.txt`
- **Orbitron** — The Orbitron Project Authors — SIL Open Font License 1.1 — see `OFL-orbitron.txt`

## Original work

- Game code (`game/src/*.js`, `main.ts`) — original, MIT (see `LICENSE`)
- Procedural key art (`game/src/keyart.js`) — canvas-drawn at runtime, zero media files
- All audio — synthesized in code at runtime (Web Audio), no audio files
- Typography identity, palette, and named settings (Cendre city, the Hollow Crown, Crown of Silence, IDs) — original

## Notes for judges

- No media is hot-linked, downloaded at run time, or referenced outside `game/`.
- `screenshots/` are real headless-browser renders of this tree; nothing was edited or composited by hand.
- License: MIT at the repository root; media licensing as above.
