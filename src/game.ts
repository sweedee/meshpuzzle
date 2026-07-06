import * as THREE from 'three';
import { sliceGeometry } from './slicer';
import { Piece } from './piece';
import { WORLD_SIZE } from './shapes';
import { bump, tween, type TweenHandle } from './tween';
import type { LevelDef } from './levels';

/** How far the lattice floats above the ground. */
const LATTICE_LIFT = 1.2;
/** Roughly how many pieces fit on one scatter ring before it gets crowded. */
const PIECES_PER_RING = 22;

export class Game {
  readonly level: LevelDef;
  readonly pieces: Piece[] = [];
  readonly latticeCenter = new THREE.Vector3();
  readonly cellSize: THREE.Vector3;
  /** Pieces snap home when released within this distance of their cell. */
  readonly snapDistance: number;
  /** Outer radius of the scatter rings (for camera limits). */
  readonly scatterRadius: number;

  onChange: () => void = () => {};
  onWin: () => void = () => {};
  /** Fired for every successful placement (audio/particles hook). */
  onPlace: (piece: Piece) => void = () => {};

  private readonly scene: THREE.Scene;
  private readonly ghost: THREE.Mesh;
  private readonly ghostMaterial: THREE.MeshBasicMaterial;
  private readonly lattice: THREE.LineSegments;
  private readonly tweens: TweenHandle[] = [];

  constructor(scene: THREE.Scene, level: LevelDef, gridOverride?: THREE.Vector3) {
    this.scene = scene;
    this.level = level;

    // Factories return ready-to-slice geometry (upright, WORLD_SIZE across).
    const geometry = level.makeGeometry();
    const dims = gridOverride ?? level.dims;

    const sliced = sliceGeometry(geometry, dims);
    this.cellSize = sliced.cellSize;
    this.snapDistance = Math.min(this.cellSize.x, this.cellSize.y, this.cellSize.z) * 0.55;

    // Shift everything so the lattice is centered on x/z and floats above y=0.
    const center = sliced.box.getCenter(new THREE.Vector3());
    const offset = new THREE.Vector3(-center.x, -sliced.box.min.y + LATTICE_LIFT, -center.z);
    this.latticeCenter.copy(center).add(offset);

    // Faint ghost of the finished shape as the build target.
    this.ghostMaterial = new THREE.MeshBasicMaterial({
      color: level.theme.ghost,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.ghost = new THREE.Mesh(geometry, this.ghostMaterial);
    this.ghost.position.copy(offset);
    this.ghost.renderOrder = -1;
    scene.add(this.ghost);

    // Wireframe edges of every occupied cell — the blocky silhouette to fill.
    const edgePositions: number[] = [];
    const half = this.cellSize.clone().multiplyScalar(0.5);
    for (const p of sliced.pieces) {
      const c = p.center.clone().add(offset);
      const corners: THREE.Vector3[] = [];
      for (let n = 0; n < 8; n++) {
        corners.push(
          new THREE.Vector3(
            c.x + (n & 1 ? half.x : -half.x),
            c.y + (n & 2 ? half.y : -half.y),
            c.z + (n & 4 ? half.z : -half.z)
          )
        );
      }
      const edges = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7];
      for (const idx of edges) edgePositions.push(corners[idx].x, corners[idx].y, corners[idx].z);
    }
    const latticeGeo = new THREE.BufferGeometry();
    latticeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
    this.lattice = new THREE.LineSegments(
      latticeGeo,
      new THREE.LineBasicMaterial({ color: level.theme.lattice, transparent: true, opacity: 0.28 })
    );
    scene.add(this.lattice);

    for (const p of sliced.pieces) {
      const piece = new Piece(p, this.cellSize, p.center.clone().add(offset), {
        base: level.theme.pieceBase,
        locked: level.theme.pieceLocked,
      });
      this.pieces.push(piece);
      scene.add(piece);
    }

    const ringCount = Math.max(1, Math.ceil(this.pieces.length / PIECES_PER_RING));
    const ringStep = Math.max(this.cellSize.x, this.cellSize.z) * 1.6;
    this.scatterRadius = WORLD_SIZE * 0.85 + 1.5 + (ringCount - 1) * ringStep;

    this.scatter();
  }

  get placed(): number {
    return this.pieces.filter((p) => p.locked).length;
  }

  get total(): number {
    return this.pieces.length;
  }

  /**
   * Ring the unsolved pieces around the lattice on the ground; when animated
   * they hop outward from under the lattice with a small stagger.
   */
  scatter(animate = false, onComplete?: () => void): void {
    const order = [...this.pieces].sort(() => Math.random() - 0.5);
    const baseRadius = WORLD_SIZE * 0.85 + 1.5;
    const ringCount = Math.max(1, Math.ceil(order.length / PIECES_PER_RING));
    const ringStep = Math.max(this.cellSize.x, this.cellSize.z) * 1.6;
    const perRing = Math.ceil(order.length / ringCount);
    const origin = new THREE.Vector3(0, this.cellSize.y * 0.5 + 0.02, 0);
    let pending = order.length;
    order.forEach((piece, n) => {
      const ring = n % ringCount;
      const radius = baseRadius + ring * ringStep;
      const angle = ((Math.floor(n / ringCount) + ring / ringCount) / perRing) * Math.PI * 2;
      piece.position.set(
        Math.cos(angle) * radius,
        this.cellSize.y * 0.5 + 0.02,
        Math.sin(angle) * radius
      );
      if (animate) {
        piece.flyIn(origin, n * 15, () => {
          if (--pending === 0) onComplete?.();
        });
      }
    });
    if (!animate) onComplete?.();
  }

  /** Snap the piece home if it's close enough; returns whether it locked. */
  tryPlace(piece: Piece): boolean {
    if (piece.locked) return false;
    if (piece.position.distanceTo(piece.home) > this.snapDistance) return false;
    // The win fires when the snap animation of the final piece lands.
    piece.lock(() => {
      if (this.placed === this.total) this.onWin();
    });
    this.onPlace(piece);
    this.onChange();
    return true;
  }

  reset(animate = false, onComplete?: () => void): void {
    for (const piece of this.pieces) piece.unlock();
    this.scatter(animate, onComplete);
    this.onChange();
  }

  /** Win celebration: ghost glow pulse + bottom-up wave through the pieces. */
  celebrate(): void {
    const baseOpacity = 0.09;
    this.tweens.push(
      tween({
        duration: 1100,
        ease: bump,
        onUpdate: (t) => {
          this.ghostMaterial.opacity = baseOpacity + t * 0.14;
        },
        onComplete: () => {
          this.ghostMaterial.opacity = baseOpacity;
        },
      })
    );
    for (const piece of this.pieces) piece.pulse(250 + piece.cell.y * 110, 0.12);
  }

  /** Debug/test helper: place every piece and trigger the win flow. */
  solve(): void {
    for (const piece of this.pieces) {
      piece.position.copy(piece.home);
      this.tryPlace(piece);
    }
  }

  /** Remove everything from the scene and release GPU resources. */
  dispose(): void {
    for (const t of this.tweens) t.cancel();
    this.tweens.length = 0;
    this.scene.remove(this.ghost);
    this.ghost.geometry.dispose();
    this.ghostMaterial.dispose();
    this.scene.remove(this.lattice);
    this.lattice.geometry.dispose();
    (this.lattice.material as THREE.Material).dispose();
    for (const piece of this.pieces) {
      this.scene.remove(piece);
      piece.dispose();
    }
    this.pieces.length = 0;
  }
}
