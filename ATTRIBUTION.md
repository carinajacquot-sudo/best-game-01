# ATTRIBUTION & PROVENANCE

Ember Wing is an original game. This file documents the provenance of every non-original byte in the tree.

## Media in this entry — none beyond fonts

This submission ships **no image, audio or video assets**:

- Key art and all scenery are drawn at runtime on canvas (see `game/src/keyart.js`, `game/src/background.js`).
- All sound — soundtrack and effects — is synthesized at runtime with Web Audio (`game/src/audio.js`).
- Earlier development builds embedded painted AI-generated images in `game/assets/v6/` (SDXL-Turbo
  outputs from a Kaggle kernel, and images from a local image tool whose redistribution terms could
  not be verified). They are **all removed from this submission** so that every byte shipped is either
  original code or redistributable under the licenses below. A FLUX.1-schnell (Apache-2.0)
  regeneration was queued on Kaggle but had not completed when the entry was submitted.

## Fonts — `game/assets/fonts/`

- **Monoton** — The Monoton Project Authors — SIL Open Font License 1.1 — see `OFL-monoton.txt`
- **Orbitron** — The Orbitron Project Authors — SIL Open Font License 1.1 — see `OFL-orbitron.txt`

## Original work

- Game code (`game/src/*.js`, `main.ts`) — original, MIT (see `LICENSE`)
- Key art (`game/src/keyart.js`) — canvas-drawn at runtime, zero media files
- All audio — synthesized in code at runtime (Web Audio), no audio files
- Typography identity, palette, and named settings (Cendre city, the Hollow Crown, Crown of Silence, IDs) — original

## Notes for judges

- No media is hot-linked, downloaded at run time, or referenced outside `game/`.
- `screenshots/` are real headless-browser renders of this tree; nothing was edited or composited by hand.
- License: MIT at the repository root; font licensing as above.
