import * as THREE from 'three';
import {
  makeGear,
  makeGem,
  makeHeart,
  makeKnot,
  makeMug,
  makePawn,
  makeRocket,
  makeRook,
  makeStar,
  makeTeapot,
  makeVase,
} from './shapes';

export interface Theme {
  /** Scene background + fog. */
  bg: number;
  pieceBase: number;
  pieceLocked: number;
  ghost: number;
  lattice: number;
  /** Directional light tint. */
  sun: number;
  /** CSS accent color for HUD/menus (set as a custom property). */
  accent: string;
}

export interface LevelDef {
  /** Stable save key. */
  id: string;
  name: string;
  /** Emoji for the level-select tile. */
  icon: string;
  /** Fresh, ready-to-slice geometry each call. */
  makeGeometry: () => THREE.BufferGeometry;
  /** Grid resolution. */
  dims: THREE.Vector3;
  theme: Theme;
  /** Seconds-per-piece budget for the 3-star time. */
  timePar: number;
  /** Moves-per-piece budget for the 3-star move count. */
  movePar: number;
  hint?: string;
}

const defaults = { timePar: 5, movePar: 1.4 };

export const LEVELS: LevelDef[] = [
  {
    ...defaults,
    id: 'gem',
    name: 'Crystal',
    icon: '💎',
    makeGeometry: makeGem,
    dims: new THREE.Vector3(2, 2, 2),
    timePar: 7,
    hint: 'Drag pieces into the glowing outline · drag empty space to orbit',
    theme: {
      bg: 0x16222b, pieceBase: 0xc7e0dc, pieceLocked: 0xb4d2cd,
      ghost: 0x6fd6c8, lattice: 0x3f8f85, sun: 0xeafff8, accent: '#4fd1c5',
    },
  },
  {
    ...defaults,
    id: 'star',
    name: 'Star',
    icon: '⭐',
    makeGeometry: makeStar,
    dims: new THREE.Vector3(3, 3, 2),
    timePar: 6,
    theme: {
      bg: 0x171a2b, pieceBase: 0xe8dcb8, pieceLocked: 0xd8cba2,
      ghost: 0xf0c94a, lattice: 0xa88c3f, sun: 0xfff3d0, accent: '#fbbf24',
    },
  },
  {
    ...defaults,
    id: 'heart',
    name: 'Heart',
    icon: '❤️',
    makeGeometry: makeHeart,
    dims: new THREE.Vector3(3, 3, 2),
    timePar: 6,
    theme: {
      bg: 0x241a24, pieceBase: 0xe8c8d2, pieceLocked: 0xd8b4c2,
      ghost: 0xef7ea8, lattice: 0xa85578, sun: 0xffe8ee, accent: '#f472b6',
    },
  },
  {
    ...defaults,
    id: 'mug',
    name: 'Mug',
    icon: '☕',
    makeGeometry: makeMug,
    dims: new THREE.Vector3(3, 3, 3),
    theme: {
      bg: 0x221c17, pieceBase: 0xd9c5b2, pieceLocked: 0xc9b3a0,
      ghost: 0xc08a52, lattice: 0x8a6238, sun: 0xffe9d0, accent: '#d97706',
    },
  },
  {
    ...defaults,
    id: 'pawn',
    name: 'Pawn',
    icon: '♟️',
    makeGeometry: makePawn,
    dims: new THREE.Vector3(3, 3, 3),
    theme: {
      bg: 0x1d1f22, pieceBase: 0xe6e2da, pieceLocked: 0xd4cfc6,
      ghost: 0xb8c4cc, lattice: 0x6b7680, sun: 0xfff6e8, accent: '#94a3b8',
    },
  },
  {
    ...defaults,
    id: 'rocket',
    name: 'Rocket',
    icon: '🚀',
    makeGeometry: makeRocket,
    dims: new THREE.Vector3(3, 5, 3),
    theme: {
      bg: 0x141b2b, pieceBase: 0xd8dde8, pieceLocked: 0xc6ccd8,
      ghost: 0xff8c42, lattice: 0xa05a2c, sun: 0xffe0c0, accent: '#fb923c',
    },
  },
  {
    ...defaults,
    id: 'teapot',
    name: 'Teapot',
    icon: '🫖',
    makeGeometry: () => makeTeapot(7),
    dims: new THREE.Vector3(4, 3, 3),
    theme: {
      bg: 0x1a2028, pieceBase: 0xd9d0c7, pieceLocked: 0xcfc6bd,
      ghost: 0x9cc3e8, lattice: 0x5f88ad, sun: 0xfff2e0, accent: '#7fb4e8',
    },
  },
  {
    ...defaults,
    id: 'vase',
    name: 'Vase',
    icon: '🏺',
    makeGeometry: makeVase,
    dims: new THREE.Vector3(3, 5, 3),
    theme: {
      bg: 0x231a15, pieceBase: 0xe0b9a0, pieceLocked: 0xd0a78e,
      ghost: 0xe08a5f, lattice: 0x9c5f3e, sun: 0xffe6cc, accent: '#ea8a5b',
    },
  },
  {
    ...defaults,
    id: 'knot',
    name: 'Torus Knot',
    icon: '🌀',
    makeGeometry: makeKnot,
    dims: new THREE.Vector3(4, 3, 4),
    theme: {
      bg: 0x1e1526, pieceBase: 0xd8c6e8, pieceLocked: 0xc6b2d8,
      ghost: 0xc06ae8, lattice: 0x7f47a0, sun: 0xf4e4ff, accent: '#c084fc',
    },
  },
  {
    ...defaults,
    id: 'gear',
    name: 'Gear',
    icon: '⚙️',
    makeGeometry: makeGear,
    dims: new THREE.Vector3(5, 5, 2),
    theme: {
      bg: 0x161d20, pieceBase: 0xc8d2d8, pieceLocked: 0xb6c1c8,
      ghost: 0x55d0e8, lattice: 0x3a8ba0, sun: 0xe8f8ff, accent: '#22d3ee',
    },
  },
  {
    ...defaults,
    id: 'rook',
    name: 'Rook',
    icon: '🏰',
    makeGeometry: makeRook,
    dims: new THREE.Vector3(3, 6, 3),
    theme: {
      bg: 0x201d16, pieceBase: 0xe2d3b4, pieceLocked: 0xd2c2a2,
      ghost: 0xd8b878, lattice: 0x97804f, sun: 0xfff0d4, accent: '#d4a94f',
    },
  },
  {
    ...defaults,
    id: 'grand-teapot',
    name: 'Grand Teapot',
    icon: '🏆',
    makeGeometry: () => makeTeapot(8),
    dims: new THREE.Vector3(5, 4, 5),
    theme: {
      bg: 0x0f0d0a, pieceBase: 0xe8d29a, pieceLocked: 0xd8c288,
      ghost: 0xf5c842, lattice: 0xa8862e, sun: 0xffe9b0, accent: '#facc15',
    },
  },
];

export function levelById(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function levelIndex(id: string): number {
  return LEVELS.findIndex((l) => l.id === id);
}
