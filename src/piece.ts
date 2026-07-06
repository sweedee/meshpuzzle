import * as THREE from 'three';
import type { SlicedPiece } from './slicer';
import { backOut, bump, tween, type TweenHandle } from './tween';

const FLASH_COLOR = new THREE.Color(0x2fae5e);
const SNAP_MS = 200;
const FLASH_MS = 450;

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
  private readonly tweens: TweenHandle[] = [];

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

  /**
   * Lock the piece: ease it the last stretch home, flash, pulse.
   * `onSettled` fires once the snap animation lands (win checks hook here).
   */
  lock(onSettled?: () => void): void {
    this.locked = true;
    this.setHighlight(false);
    this.cancelTweens();

    const from = this.position.clone();
    if (from.distanceToSquared(this.home) < 1e-6) {
      this.position.copy(this.home);
      this.pulse();
      onSettled?.();
    } else {
      this.tweens.push(
        tween({
          duration: SNAP_MS,
          ease: backOut,
          onUpdate: (t) => this.position.lerpVectors(from, this.home, t),
          onComplete: () => {
            this.position.copy(this.home);
            this.pulse();
            onSettled?.();
          },
        })
      );
    }

    // Green flash decaying into the locked tint.
    const flashFrom = FLASH_COLOR.clone();
    this.material.color.copy(flashFrom);
    this.tweens.push(
      tween({
        duration: FLASH_MS,
        onUpdate: (t) => this.material.color.lerpColors(flashFrom, this.lockedColor, t),
      })
    );
  }

  /** Quick scale pop, also used by the win-wave celebration. */
  pulse(delay = 0, strength = 0.09): void {
    this.tweens.push(
      tween({
        duration: 280,
        delay,
        ease: bump,
        onUpdate: (t) => {
          const s = 1 + strength * t;
          this.scale.set(s, s, s);
        },
        onComplete: () => this.scale.set(1, 1, 1),
      })
    );
  }

  /** Animate from `from` to the piece's current (scatter) position. */
  flyIn(from: THREE.Vector3, delay: number, onDone?: () => void): void {
    const target = this.position.clone();
    const start = from.clone();
    this.position.copy(start);
    this.tweens.push(
      tween({
        duration: 500,
        delay,
        onUpdate: (t) => {
          this.position.lerpVectors(start, target, t);
          // Parabolic hop on top of the straight-line path.
          this.position.y += Math.sin(t * Math.PI) * 1.4;
        },
        onComplete: () => {
          this.position.copy(target);
          onDone?.();
        },
      })
    );
  }

  unlock(): void {
    this.locked = false;
    this.cancelTweens();
    this.scale.set(1, 1, 1);
    this.material.color.copy(this.baseColor);
    this.setHighlight(false);
  }

  private cancelTweens(): void {
    for (const t of this.tweens) t.cancel();
    this.tweens.length = 0;
  }

  dispose(): void {
    this.cancelTweens();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.collider.geometry.dispose();
    this.colliderMaterial.dispose();
  }
}
