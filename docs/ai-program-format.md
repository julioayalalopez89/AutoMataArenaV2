# ECHO AI program format (v0, draft)

The AI program is the file the player builds in the game's lab. The **same file** runs in two places:

- **Unity game:** ECHO's AI in the virtual arena.
- **Raspberry Pi robot:** a small runner reads the file and sends commands to `robot_pi.py`.

Both sides must read this format the same way, so this document is the contract between them.

## Design rules

1. **Actions are the real robot's commands.** The game cannot ask for something the robot can't do.
2. **Rules are checked from top to bottom, every tick.** The first rule whose conditions are all true runs its action. If none match, the `default` action runs.
3. **Sensors are simple numbers.** Both the game and the robot must be able to measure them (the robot may need extra sensors later).
4. **Plain JSON, versioned.** Easy to read, edit, send over Wi-Fi and validate.

## Actions

These map 1:1 to `VALID_CMDS` in `server/src/server.js` and the commands in `server/robot_pi.py`.

| Action | Robot command | Notes |
| --- | --- | --- |
| `move_forward` | `UP` | Held for `duration_ms`, then `STOP_UP` |
| `move_back` | `DOWN` | Then `STOP_DOWN` |
| `turn_left` | `LEFT` | Then `STOP_LEFT` |
| `turn_right` | `RIGHT` | Then `STOP_RIGHT` |
| `punch_left` | `PUNCH_L` | 8 damage by default |
| `punch_right` | `PUNCH_R` | 10 damage by default |
| `kick` | `KICK` | Fast forward charge, 15 damage by default |
| `special` | `SPECIAL` | 360° spin with both arms, 25 damage by default |
| `wait` | (none) | Do nothing for `duration_ms` |

## Sensors (conditions)

| Sensor | Type | Meaning |
| --- | --- | --- |
| `enemy_distance` | number, cm | Distance to the enemy |
| `enemy_angle` | number, degrees | -180 to 180; 0 = straight ahead, negative = left |
| `my_hp` | number, 0–100 | Own health |
| `enemy_hp` | number, 0–100 | Enemy health |
| `heat` | number, 0–100 | Rises with attacks; at 100 the robot can't attack (game only for now) |
| `time_left` | number, seconds | Time left in the match |

A condition is `{ "sensor": "...", "op": "<", "value": 30 }`. Operators: `<`, `<=`, `>`, `>=`, `==`, `!=`.

## Example

See [`examples/echo-default.json`](examples/echo-default.json):

```json
{
  "format": "echo-ai",
  "version": 0,
  "name": "ECHO starter",
  "tick_ms": 100,
  "rules": [
    {
      "name": "Cool down",
      "when": [{ "sensor": "heat", "op": ">=", "value": 80 }],
      "do": { "action": "move_back", "duration_ms": 400 }
    },
    {
      "name": "Finish them",
      "when": [
        { "sensor": "enemy_hp", "op": "<", "value": 25 },
        { "sensor": "enemy_distance", "op": "<", "value": 30 }
      ],
      "do": { "action": "special" }
    }
  ],
  "default": { "action": "move_forward", "duration_ms": 200 }
}
```

The JSON Schema is in [`ai-program.schema.json`](ai-program.schema.json).

## Open questions

- Which sensors can the real robot measure? `enemy_distance` and `enemy_angle` need a sensor or an overhead camera.
- Should the player's direct commands during a fight override the program for a moment?
- Do we need variables or timers (for example "only use special once every 10 seconds")?
