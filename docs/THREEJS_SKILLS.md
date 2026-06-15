# Three.js Game Skills — How They Apply to Deep Cast

This repo has the [`majidmanzarpour/threejs-game-skills`](https://github.com/majidmanzarpour/threejs-game-skills)
pack installed at the **project level** in `.claude/skills/`. Because they live in
the repo, they are available to every Claude Code / Codex session here and travel
with the project — no global install or re-install per session.

These are agent skills, not runtime code. They give the agent specialized
playbooks, checklists, and helper scripts for building a polished Three.js browser
game — which is exactly what Deep Cast is.

## The 9 skills

| Skill | What it's for | Needs API key? |
| --- | --- | --- |
| `threejs-game-director` | Top-level orchestrator. Routes work to the specialist skills and keeps build/QA ledgers. **Start here for broad work.** | No |
| `threejs-gameplay-systems` | Mechanics, game loop, entities, input, physics, camera, game feel, first-playable scaffolds. | No |
| `threejs-aaa-graphics-builder` | Lifts visuals from prototype to premium: models, materials, lighting, VFX, render pipeline, visual scorecard gates. | No |
| `threejs-game-ui-designer` | HUDs, menus, overlays, responsive layout, safe areas, touch controls, text fit. | No |
| `threejs-debug-profiler` | Runtime/render/loading/resize/mobile-input bugs; perf profiling (draw calls, triangles, memory, bundle). | No |
| `threejs-qa-release` | Browser verification, screenshots, canvas-pixel checks, mobile viewport checks, production build + preview, release risk report. | No |
| `threejs-3d-generator` | Text/image-to-3D game-ready GLB/FBX assets via Tripo. | `TRIPO_API_KEY` |
| `threejs-image-generator` | Concept art, textures, sky plates, decals, icons, GUI art via Gemini. | `GEMINI_API_KEY` |
| `threejs-audio-generator` | SFX, ambience loops, UI sounds, voice via ElevenLabs. | `ELEVENLABS_API_KEY` |

The first six work with no keys. The three generators degrade gracefully — without
keys the agent skips external generation and falls back to procedural/local assets.
**Never commit API keys or put them in browser-side code**; set them in the shell
environment only.

## Mapping to `BUILD_PLAN.md` and current code

| Build plan phase | Lead skill(s) | Touches |
| --- | --- | --- |
| **1. Social presence & world life** | `threejs-game-ui-designer`, `threejs-gameplay-systems` | `ui/MultiplayerUI.ts`, `multiplayer/*`, `state/PlayerState.ts` |
| **2. Skill-based fish fight** | `threejs-gameplay-systems` | `fishing/FightModel.ts`, `fishing/FishingStateMachine.ts`, `ui/GameUI.ts` |
| **3. Visible fish & lure gameplay** | `threejs-gameplay-systems`, `threejs-aaa-graphics-builder` | `entities/AmbientFish.ts`, `entities/FishShadow.ts`, `effects/RippleSystem.ts`, `effects/ParticleSystem.ts`, `effects/BiteIndicator.ts` |
| **4. Unique maps** | `threejs-aaa-graphics-builder`, `threejs-image-generator` | `world/WaterSystem.ts`, `world/SkySystem.ts`, `world/LightingSystem.ts`, `world/FogEventSystem.ts`, `world/TerrainSystem.ts`, `data/biome-config.ts` |
| **5. Depth & sonar (signature systems)** | `threejs-gameplay-systems`, `threejs-game-ui-designer` | new `DepthSystem`, sonar overlay, `world/DeepWaterMarker.ts` |
| **6. Multiplayer game modes** | `threejs-gameplay-systems`, `threejs-game-ui-designer` | `multiplayer/MultiplayerBridge.ts`, `multiplayer/fishing-spots.ts`, backend client |

Cross-cutting, useful in every phase:

- **`threejs-aaa-graphics-builder`** — overall water/fish/lighting/VFX polish.
- **`threejs-debug-profiler`** — mobile is a first-class target here (`ui/MobileControls.ts`), so profile DPR/input and draw calls.
- **`threejs-qa-release`** — gate each phase with a real `npm run build` + preview + screenshot before calling it done.
- **`threejs-audio-generator`** — feeds `audio/SoundSystem.ts` (cast, splash, reel tension, bite, ambience loops per map).
- **`threejs-3d-generator`** — hero assets that procedural code rarely nails: boats, legendary monster fish (e.g. The Bellmouth, Cinderjaw), signature props.
- **`threejs-image-generator`** — per-map sky plates, water/terrain textures, journal/shop icons and UI art.

## How to use

For broad work, name the director and let it route:

```text
Use threejs-game-director to implement Phase 2 (skill-based fish fight) from
docs/BUILD_PLAN.md. Build the tension/stamina/progress fight model in
src/fishing/FightModel.ts, wire it into FishingStateMachine, update the reeling UI,
then verify with a build, browser check, and screenshot before claiming done.
```

For a targeted change, invoke a specialist directly, e.g. `threejs-aaa-graphics-builder`
for a new map's water/sky look, or `threejs-game-ui-designer` for the online-anglers HUD.

## Recommended first slice

Per the build plan's recommended order, the highest-leverage first step is
**Phase 1 (online players HUD + catch feed)** with `threejs-game-ui-designer`, then
**Phase 2 (fish fight)** with `threejs-gameplay-systems` — both are no-key, high-impact,
and build directly on code that already exists.
