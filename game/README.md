# RoboWar — the game (Unity)

Story-driven robot building, programming and arena-fight game for PC (Steam), made in Unity.
The robot you program in the game's lab is the same robot you can run on the real AutoMataArenaV2 hardware.

- **Design document:** [RoboWar — Game Design Document](https://claude.ai/artifact/Q4nZN8pQckfReiVemt89No) (summary in [`../docs/game-design.md`](../docs/game-design.md))
- **AI program format (shared with the Raspberry Pi):** [`../docs/ai-program-format.md`](../docs/ai-program-format.md)

## Status

Phase 1, Prototype: grey-box arena, ECHO vs Crusher, move / attack / dash. The goal is to answer one question: **is fighting fun?**

## Create the Unity project (one-time, on Julio's PC)

The Unity project lives in **this folder** (`game/`), so the `.gitignore` here applies to it.

1. Install **Unity Hub** and the current **Unity LTS** editor.
2. In Unity Hub: **New project → Universal 3D (URP)**. Name it `RoboWar`, and choose a temporary location.
3. Close Unity. Move the contents of the new project folder (`Assets/`, `Packages/`, `ProjectSettings/`) into this `game/` folder.
4. In Unity Hub: **Add → Add project from disk →** select `game/`.
5. Commit only `Assets/`, `Packages/` and `ProjectSettings/`. The `.gitignore` already excludes `Library/`, `Temp/`, `Logs/` and builds.

## Folder plan (inside `Assets/`)

```
Assets/
├── _Project/
│   ├── Scenes/        Lab, Arena_Pit, Core_Memory01
│   ├── Scripts/
│   │   ├── Robots/    movement, attacks, armor, heat
│   │   ├── AI/        reads and runs the echo-ai JSON program
│   │   └── UI/
│   ├── Prefabs/
│   ├── Art/           models, materials, shaders
│   └── Data/          AI programs (.json), robot stats
└── ThirdParty/        asset store packs
```

Keeping our files under `_Project/` keeps them apart from imported packs.
