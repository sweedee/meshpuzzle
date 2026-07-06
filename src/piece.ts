import * as THREE from 'three';
import type { SlicedPiece } from './slicer';

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
  private readonly colliderMaterial: THREE.MeshBasicMaterial;
  private readonly baseColor: THREE.Color;
  private readonly lockedColor: THREE.Color;
  private flashTimer = 0;

  constructor(
    sliced: SlicedPiece,
    cellSize: THREE.Vector3,
    home: THREE.Vector3,
    colors: { base: number; locked: number }
  ) {
    super();
    this.home = home.clone();
    this.cell = sliced.cell.clone();
    this.baseColor = new THREE.Color(colors.base);
    this.lockedColor = new THREE.Color(colors.locked);

    this.material = new THREE.MeshStandardMaterial({
      color: this.baseColor,
      roughness: 0.55,
      metalness: 0.05,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(sliced.geometry, this.material);
    this.add(this.mesh);

    this.colliderMaterial = new THREE.MeshBasicMaterial({ visible: false });
    this.collider = new THREE.Mesh(
      new THREE.BoxGeometry(cellSize.x, cellSize.y, cellSize.z),
      this.colliderMaterial
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
    this.flashTimer = window.setTimeout(() => this.material.color.copy(this.lockedColor), 450);
  }

  unlock(): void {
    this.locked = false;
    window.clearTimeout(this.flashTimer);
    this.material.color.copy(this.baseColor);
    this.setHighlight(false);
  }

  dispose(): void {
    window.clearTimeout(this.flashTimer);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.collider.geometry.dispose();
    this.colliderMaterial.dispose();
  }
}
