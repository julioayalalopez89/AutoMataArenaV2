# RoboWar — game design summary

The full, living design document is here: **[RoboWar — Game Design Document](https://claude.ai/artifact/Q4nZN8pQckfReiVemt89No)**. This file is a short summary for the repo. If they disagree, the full document wins.

## Pitch

A story-driven robot building and programming game with arena fights, for PC on Steam, built in Unity. A scrap mechanic, Rin, and a broken robot with lost memories, ECHO, fight their way up the arenas of a rusted megacity. Each win unlocks a memory set in a glowing code world.

## Decisions so far

- **World:** two layers. The Rust (a ruined physical megacity) and the Core (the code world inside every robot's mind).
- **Version 1 is single-player.** Multiplayer comes in later updates: local first, then online and real-robot fights.
- **The lab is the core of the game.** It's a hangar with 4 bays, and only Rin's bay is playable in v1. It's small and packed with parts and robots, with a hologram table, a programming terminal, a practice ring and a trophy wall.
- **Core loop:** lab (parts + AI program) → arena fight → salvage → Core memory.
- **Combat:** ECHO follows its AI program, and the player steps in with a few direct commands.
- **Link to the real robot:** the AI program uses one shared format ([`ai-program-format.md`](ai-program-format.md)) that both Unity and the Raspberry Pi run. One bay equals one physical robot.
- **Art:** stylized low-poly 3D in Unity URP. The Rust is warm and dirty, and the Core is cold and glowing. There are about 10–15 modular robot parts, reused everywhere.

## Roadmap

1. **Prototype:** grey-box arena, ECHO vs Crusher. Check: is fighting fun?
2. **Vertical slice:** the Pit, 2 rivals, the lab, 1 Core memory, final art for 1 arena. Check: does it look like the final game?
3. **Steam page + demo:** $100 Steam Direct fee, trailer, demo, wishlists. Check: do players wishlist it?
4. **Full game v1:** acts 1–3, 5 robots, polish, launch.
