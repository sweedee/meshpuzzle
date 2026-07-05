import * as THREE from 'three';
import type { SlicedPiece } from './slicer';

const BASE_COLOR = new THREE.Color(0xd9d0c7);
const LOCKED_COLOR = new THREE.Color(0xcfc6bd);
const FLASH_COLOR = new THREE.Color(0x2fae5e);

export class Piece extends THREE.Group {
  /** Solved position in world space. */
  readonly home: THREE.Vector3;
  readonly cell: THREE.Vector3;
  readonly mesh: THREE.Mesh;
  /** Invisible cell-sized box so touch targets stay fat-finger friendly. */
  readonly collider: THREE.Mesh;
  locked = false;

  private readonly material: THREE.MeshStandardMaterial;
  private flashTimer = 0;

  constructor(sliced: SlicedPiece, cellSize: THREE.Vector3, home: THREE.Vector3) {
    super();
    this.home = home.clone();
    this.cell = sliced.cell.clone();

    this.material = new THREE.MeshStandardMaterial({
      color: BASE_COLOR,
      roughness: 0.55,
      metalness: 0.05,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(sliced.geometry, this.material);
    this.add(this.mesh);

    this.collider = new THREE.Mesh(
      new THREE.BoxGeometry(cellSize.x, cellSize.y, cellSize.z),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.collider.userData.piece = this;
    this.add(this.collider);
  }

  setHighlight(on: boolean): void {
    this.material.emissive.setHex(on ? 0x2a4a6a : 0x000000);
  }

  lock(): void {
    this.locked = true;
    this.position.copy(this.home);
    this.setHighlight(false);
    this.material.color.copy(FLASH_COLOR);
    window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => this.material.color.copy(LOCKED_COLOR), 450);
  }

  unlock(): void {
    this.locked = false;
    window.clearTimeout(this.flashTimer);
    this.material.color.copy(BASE_COLOR);
    this.setHighlight(false);
  }
}
