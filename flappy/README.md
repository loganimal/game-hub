# Flappy Bird

A pixel-retro Flappy Bird clone built entirely in a single HTML file — no dependencies, no assets, just a browser.

## How to Play

- **Click**, **tap**, or press **Space** to make the bird flap upward.
- Navigate through the gaps between the green pipes.
- Each pipe pair you pass earns **1 point**.
- Hitting a pipe, the ground, or the ceiling ends the game.

## Features

- **Pixel art rendering** — bird, pipes, clouds, and ground are all drawn procedurally on an HTML5 Canvas. No images needed.
- **Smooth physics** — gravity, flap velocity, and rotation based on momentum.
- **Progressive difficulty** — pipes spawn at random heights with a fixed gap.
- **Score tracking** — current score shown during play; best score persisted to `localStorage`.
- **Particle effects** — a burst of particles on collision.
- **Game states** — start screen, active play, and game over overlay with score summary.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Rendering | HTML5 Canvas (2D) |
| Game Loop | `requestAnimationFrame` |
| Input | Click, touch, keyboard (Space) |
| Persistence | `localStorage` (best score) |
| Styling | CSS `image-rendering: pixelated` |

## Files

```
index.html   — the entire game (single file)
README.md    — this file
```

## Running

Open `index.html` in any modern browser. No server required.
