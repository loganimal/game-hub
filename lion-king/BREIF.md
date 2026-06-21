# Lion King of the Jungle — Arcade Fighting Game

## What We Built

A browser-based arcade fighting game where you play as a lion fighting through 3 progressively harder animal opponents in a jungle arena. The game runs entirely from a single HTML file — no installs, no builds, just open and play.

**3 Opponents:**
| Opponent | Ability | Difficulty |
|----------|---------|------------|
| 🐢 Turtle | Slow, predictable punches | Easy |
| 🐰 Rabbit | Fast movement, dash attack | Medium |
| 🐻 Bear | Blocks attacks, enrages at low HP, dash attack | Hard |

**Upgrade System:** After each win, earn 1 point to spend in the shop:
- 💪 Power Up — +1 damage for rest of the game
- 🍎 Full Heal — restore all hearts
- ⚡ Unlock Kick — longer-range kick (press X)
- 🦁 Unlock Roar — stuns opponent (press C)

**Tree Platforms:** Jump onto tree branches to gain height advantage. Press ↓ to drop through them.

---

## How to Play

1. Open `index.html` in any browser
2. Press **SPACE** on the title screen to start

**Controls:**

| Key | Action |
|-----|--------|
| ← → | Move left/right |
| ↑ | Jump |
| ↓ (on branch) | Drop through tree platform |
| Z | Punch |
| X | Kick (unlock in shop) |
| C | Roar — stuns opponent (unlock in shop) |

**Hearts System:**
- Each fighter has 3 hearts per round
- Best of 3 rounds per fight
- Lose all hearts in a round = round lost
- Win 2 rounds = fight won

---

## How to Tweak the Game

Open `index.html` in a text editor. All the fun numbers are at the top.

**Speed up / slow down the game:**
```
CONFIG.gravity = 0.6;       // Higher = faster falling
CONFIG.punchDuration = 8;   // Frames punch is active
CONFIG.punchCooldown = 18;  // Frames before you can punch again
```

**Change an opponent:**
Find `OPPONENT_CONFIGS` and change values like `speed`, `hearts`, or `aiAggression`:
```
{ name: 'Turtle', speed: 2.2, hearts: 3, aiAggression: 0.5, ... }
```

**Change the platforms:**
Find `PLATFORMS` and add/remove/modify branches:
```
PLATFORMS = [
  { x: 60, y: 380, w: 130, h: 18 },   // Left branch
  { x: 610, y: 380, w: 130, h: 18 },  // Right branch
  { x: 320, y: 290, w: 160, h: 18 },  // Center high branch
];
```

---

## How He Can Make His Own Character (Draw Pixel Art)

The game currently draws all characters with code (shapes and colors). He can replace them with his own pixel art!

**What you need:**
- A free pixel art tool like [Piskel](https://www.piskelapp.com/) or [Pixilart](https://www.pixilart.com/)
- Or any image editor

**Sprite sheet format (for each character):**
- 64x64 pixels per frame
- Frames in a single row (left to right):
  `[Idle 1] [Idle 2] [Walk 1] [Walk 2] [Punch] [Hit] [KO]`
- Total sheet size: 448x64 pixels for 7 frames

**Example — replacing the lion sprites:**
1. Draw the sprite sheet and save as `sprites/lion.png`
2. In the code, find the `drawAnimal` method and change it to load the image

I can help with step 2 when he's ready with his drawings.

---

## Next Steps / Ideas to Add

Ideas he can try, from easiest to hardest:

1. **New opponent** — Add a 4th animal (snake? eagle? elephant?) by adding to `OPPONENT_CONFIGS` and creating a `drawSnake()` / `drawEagle()` / etc. method

2. **New upgrade** — Add more shop items (e.g., "Double Jump", "Faster Punch", "Fire Breath")

3. **More platforms** — Add a vine you can swing on, or a tree house stage

4. **Super meter** — Build up energy by landing hits, then press a button for a super attack

5. **Two-player mode** — Let a friend play as the opponent with a second keyboard

6. **Sound effects** — Record his own roars and punches, drop them in a `sounds/` folder, and swap the Web Audio synthesis for `.wav` files

7. **Health bars** — Switch from hearts to a classic red/green health bar (different game feel)

8. **Boss fight** — A giant gorilla or elephant that takes up 1/3 of the screen

9. **Title screen art** — Draw a pixel art title screen background

10. **Your own idea!** — What would make the game more fun?

---

## Tech Stack

- **Language:** Vanilla JavaScript (no frameworks)
- **Rendering:** HTML5 Canvas 2D
- **Audio:** Web Audio API (synthesized sounds, no files needed)
- **File:** Single `index.html` — open in any browser, zero setup
