import * as THREE from 'three';
import { TeapotGeometry } from 'three/examples/jsm/geometries/TeapotGeometry.js';
import { sliceGeometry } from './slicer';
import { Piece } from './piece';

/** Largest dimension of the puzzle mesh in world units. */
const WORLD_SIZE = 7;
/** How far the lattice floats above the ground. */
const LATTICE_LIFT = 1.2;

export class Game {
  readonly pieces: Piece[] = [];
  readonly latticeCenter = new THREE.Vector3();
  readonly cellSize: THREE.Vector3;
  /** Pieces snap home when released within this distance of their cell. */
  readonly snapDistance: number;

  onChange: () => void = () => {};
  onWin: () => void = () => {};

  private readonly scene: THREE.Scene;

  constructor(scene: THREE.Scene, dims: THREE.Vector3) {
    this.scene = scene;

    const teapot = new TeapotGeometry(1, 8);
    teapot.deleteAttribute('uv');
    teapot.deleteAttribute('normal');

    // Normalize so the puzzle is always WORLD_SIZE across, whatever the mesh.
    const bounds = new THREE.Box3().setFromBufferAttribute(
      teapot.getAttribute('position') as THREE.BufferAttribute
    );
    const size = bounds.getSize(new THREE.Vector3());
    const scale = WORLD_SIZE / Math.max(size.x, size.y, size.z);
    teapot.scale(scale, scale, scale);

    const sliced = sliceGeometry(teapot, dims);
    this.cellSize = sliced.cellSize;
    this.snapDistance = Math.min(this.cellSize.x, this.cellSize.y, this.cellSize.z) * 0.55;

    // Shift everything so the lattice is centered on x/z and floats above y=0.
    const center = sliced.box.getCenter(new THREE.Vector3());
    const offset = new THREE.Vector3(-center.x, -sliced.box.min.y + LATTICE_LIFT, -center.z);
    this.latticeCenter.copy(center).add(offset);

    // Faint ghost of the finished teapot as the build target.
    const ghost = new THREE.Mesh(
      teapot,
      new THREE.MeshBasicMaterial({
        color: 0x9cc3e8,
        transparent: true,
        opacity: 0.09,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    ghost.position.copy(offset);
    ghost.renderOrder = -1;
    scene.add(ghost);

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
    scene.add(
      new THREE.LineSegments(
        latticeGeo,
        new THREE.LineBasicMaterial({ color: 0x5f88ad, transparent: true, opacity: 0.28 })
      )
    );

    for (const p of sliced.pieces) {
      const piece = new Piece(p, this.cellSize, p.center.clone().add(offset));
      this.pieces.push(piece);
      scene.add(piece);
    }
    this.scatter();
  }

  get placed(): number {
    return this.pieces.filter((p) => p.locked).length;
  }

  get total(): number {
    return this.pieces.length;
  }

  /** Ring the unsolved pieces around the lattice on the ground. */
  scatter(): void {
    const order = [...this.pieces].sort(() => Math.random() - 0.5);
    const baseRadius = WORLD_SIZE * 0.85 + 1.5;
    const step = Math.max(this.cellSize.x, this.cellSize.z) * 1.25;
    order.forEach((piece, n) => {
      // Alternate between two rings so pieces don't crowd each other.
      const ring = n % 2;
      const radius = baseRadius + ring * step * 1.4;
      const count = Math.ceil(order.length / 2);
      const angle = ((Math.floor(n / 2) + ring * 0.5) / count) * Math.PI * 2;
      piece.position.set(
        Math.cos(angle) * radius,
        this.cellSize.y * 0.5 + 0.02,
        Math.sin(angle) * radius
      );
    });
  }

  /** Snap the piece home if it's close enough; returns whether it locked. */
  tryPlace(piece: Piece): boolean {
    if (piece.locked) return false;
    if (piece.position.distanceTo(piece.home) > this.snapDistance) return false;
    piece.lock();
    this.onChange();
    if (this.placed === this.total) this.onWin();
    return true;
  }

  reset(): void {
    for (const piece of this.pieces) piece.unlock();
    this.scatter();
    this.onChange();
  }

  /** Debug/test helper: place every piece and trigger the win flow. */
  solve(): void {
    for (const piece of this.pieces) {
      piece.position.copy(piece.home);
      this.tryPlace(piece);
    }
  }

  dispose(): void {
    for (const piece of this.pieces) this.scene.remove(piece);
  }
}
