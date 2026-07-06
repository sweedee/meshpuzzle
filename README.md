# Mesh Puzzle 🫖

A 3D puzzle game: procedural meshes are sliced into cube-shaped pieces by a 3D grid,
the pieces are scattered on the ground, and you reassemble them. Twelve levels, from
an 8-piece crystal to a 68-piece golden teapot.

**Play:** https://sweedee.github.io/meshpuzzle/ (deployed from `main` via GitHub Pages)

## How to play

- Pick a level — each completed level unlocks the next.
- **Drag a piece** to move it. When it's near its correct cell it snaps into place and
  locks. **Drag empty space** to orbit the camera, **pinch** to zoom.
- Place all pieces to win. Faster times and fewer moves earn up to **three stars**;
  best results are saved locally. Works with touch on mobile.

## The campaign

Crystal 💎 · Star ⭐ · Heart ❤️ · Mug ☕ · Pawn ♟️ · Rocket 🚀 · Teapot 🫖 ·
Vase 🏺 · Torus Knot 🌀 · Gear ⚙️ · Rook 🏰 · Grand Teapot 🏆

Every shape is generated procedurally (`src/shapes.ts`) — extrusions, lathes, and
merged primitives; no model files are shipped. Each level has its own grid
resolution, color theme, and star budgets (`src/levels.ts`).

## How it works

The mesh surface is sliced at load time by clipping every triangle against the
axis-aligned planes of each grid cell it overlaps (Sutherland–Hodgman, `src/slicer.ts`).
This works on any triangle soup — no manifold/watertight requirements, which matters
because shapes like the teapot are self-intersecting open surfaces that CSG booleans
choke on. Pieces are hollow shells rendered double-sided; each one carries an
invisible cell-sized box collider so touch targets stay fat-finger friendly.

Everything else is equally dependency-free: animations run on a tiny tween engine
(`src/tween.ts`), placement sparks and win confetti are one pooled additive point
cloud (`src/effects.ts`), and all sound is synthesized with WebAudio at runtime
(`src/audio.ts`) — the only runtime dependency is Three.js.

Progress and settings live in versioned `localStorage` (`src/save.ts`). For
debugging, `?grid=WxHxD` overrides any level's grid resolution, e.g.
[`?grid=6x6x6`](https://sweedee.github.io/meshpuzzle/?grid=6x6x6).

## Development

```sh
npm install
npm run dev      # dev server
npm run build    # typecheck + production build to dist/
npm run preview  # serve the production build
```

Stack: [Three.js](https://threejs.org) + [Vite](https://vite.dev) + TypeScript, no
framework. Deployed by `.github/workflows/deploy.yml` on push to `main`.
