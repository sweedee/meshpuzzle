# Mesh Puzzle 🫖

A 3D puzzle game: a mesh (the Utah teapot) is sliced into cube-shaped pieces by a 3D
grid, the pieces are scattered on the ground, and you reassemble it.

**Play:** https://sweedee.github.io/meshpuzzle/ (deployed from `main` via GitHub Pages)

## How to play

- **Drag a piece** to move it. When it's near its correct cell it snaps into place and
  locks (flashes green).
- **Drag empty space** to orbit the camera, **pinch** to zoom.
- Place all pieces to win. Works with touch on mobile.
- Difficulty: change the grid resolution with a URL parameter, e.g.
  [`?grid=3x2x3`](https://sweedee.github.io/meshpuzzle/?grid=3x2x3) for fewer/bigger
  pieces (default `4x3x3`).

## How it works

The teapot surface is sliced at load time by clipping every triangle against the
axis-aligned planes of each grid cell it overlaps (Sutherland–Hodgman, `src/slicer.ts`).
This works on any triangle soup — no manifold/watertight requirements, which matters
because the teapot is a self-intersecting open surface that CSG booleans choke on.
Pieces are hollow shells rendered double-sided; each one carries an invisible
cell-sized box collider so touch targets stay fat-finger friendly.

## Development

```sh
npm install
npm run dev      # dev server
npm run build    # typecheck + production build to dist/
npm run preview  # serve the production build
```

Stack: [Three.js](https://threejs.org) + [Vite](https://vite.dev) + TypeScript, no
framework. Deployed by `.github/workflows/deploy.yml` on push to `main`.
