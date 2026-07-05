import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Game } from './game';
import type { Piece } from './piece';

/**
 * Pointer handling: touching a piece drags it, touching empty space falls
 * through to OrbitControls. Listeners are registered in the capture phase and
 * stop propagation while dragging so OrbitControls never sees those events.
 */
export class DragControls {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly dragPlane = new THREE.Plane();
  private readonly grabOffset = new THREE.Vector3();
  private readonly hit = new THREE.Vector3();
  private dragging: Piece | null = null;
  private pointerId = -1;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly dom: HTMLElement,
    private readonly orbit: OrbitControls,
    private readonly game: Game
  ) {
    dom.addEventListener('pointerdown', this.onDown, { capture: true });
    dom.addEventListener('pointermove', this.onMove, { capture: true });
    dom.addEventListener('pointerup', this.onUp, { capture: true });
    dom.addEventListener('pointercancel', this.onUp, { capture: true });
  }

  private updatePointer(e: PointerEvent): void {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private onDown = (e: PointerEvent): void => {
    if (this.dragging || !e.isPrimary) return;
    this.updatePointer(e);

    const colliders = this.game.pieces.filter((p) => !p.locked).map((p) => p.collider);
    const hits = this.raycaster.intersectObjects(colliders, false);
    if (hits.length === 0) return;

    this.dragging = hits[0].object.userData.piece as Piece;
    this.pointerId = e.pointerId;
    this.orbit.enabled = false;
    e.stopImmediatePropagation();
    this.dom.setPointerCapture(e.pointerId);

    // Drag on the camera-facing plane through the piece.
    this.camera.getWorldDirection(this.dragPlane.normal);
    this.dragPlane.setFromNormalAndCoplanarPoint(this.dragPlane.normal, this.dragging.position);
    if (this.raycaster.ray.intersectPlane(this.dragPlane, this.hit)) {
      this.grabOffset.subVectors(this.dragging.position, this.hit);
    } else {
      this.grabOffset.set(0, 0, 0);
    }
    this.dragging.setHighlight(true);
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    e.stopImmediatePropagation();
    this.updatePointer(e);

    // Magnet: when the pointer ray passes near the piece's home cell, preview
    // the snap so exact depth positioning isn't required (crucial on touch).
    if (this.raycaster.ray.distanceToPoint(this.dragging.home) < this.game.snapDistance) {
      this.dragging.position.copy(this.dragging.home);
      return;
    }

    if (this.raycaster.ray.intersectPlane(this.dragPlane, this.hit)) {
      this.dragging.position.copy(this.hit).add(this.grabOffset);
      // Keep pieces above the ground.
      this.dragging.position.y = Math.max(this.dragging.position.y, this.game.cellSize.y * 0.35);
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    e.stopImmediatePropagation();
    const piece = this.dragging;
    this.dragging = null;
    this.pointerId = -1;
    this.orbit.enabled = true;
    this.dom.releasePointerCapture(e.pointerId);
    piece.setHighlight(false);
    this.game.tryPlace(piece);
  };
}
