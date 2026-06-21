# Rami and Razi's Game Hub

A collection of browser games for Rami and Razi. Each game is a standalone HTML/JS file — no installs, no builds, just open and play.

## Games

| Game | What it is |
|------|-----------|
| **Flappy Bird** | Tap/press SPACE to flap through pipes |
| **Lion King of the Jungle** | Fighting game — beat Turtle, Rabbit and Bear |
| **Battack** | Fly a bat with laser eyes through 4 levels of aliens and zombies |
| **Teenage Mutant Crocodile Ninja Fighters** | 11-level platformer with bosses |

## Playing the Games

**Online (recommended):** https://loganimal.github.io/game-hub/

**Local server (for downloads / offline):**
```sh
cd GameHub
python3 server.py
```
Then open the printed URL on any device on the same WiFi. Click "Download ZIP" to save the games for offline play.

## Adding a New Game

1. Copy the template:
   ```sh
   cp -r template/ game-hub/new-game-name
   ```
2. Edit the game logic in `new-game-name/index.html`
3. Add a card in `index.html` (copy an existing card, swap icon/title/controls/link)
4. Commit and push:
   ```sh
   git add -A
   git commit -m "add new-game-name"
   git push
   ```
   The new game appears on GitHub Pages automatically within a minute.

## Template

`template/index.html` includes ready-to-use patterns:
- Canvas setup and game loop
- Keyboard + touch input helpers
- Particle system
- Web Audio sounds (jump, hit, death, score)
- AABB collision detection
- Score persistence (localStorage)
- Title screen / game over screen boilerplate

Delete what you don't need. The template is designed to be a starting point, not a framework.

## Updating a Game

Edit the game's `index.html`, then:
```sh
git add -A && git commit -m "update description" && git push
```

## Structure

```
GameHub/
├── server.py       ← local server (optional)
├── index.html      ← hub / launcher page
├── flappy/
├── lion-king/
├── teenage-mutant-crocodile-ninja-fighters/
└── template/
```
