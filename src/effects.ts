import * as THREE from 'three';

const MAX = 240;
const GRAVITY = -14;

/**
 * Pooled particle bursts. Dead particles are parked far below the ground and
 * faded to black — with additive blending, black is invisible, which stands in
 * for per-particle alpha without a custom shader.
 */
export class Effects {
  private readonly points: THREE.Points;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.PointsMaterial;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly velocities = new Float32Array(MAX * 3);
  /** Remaining life in seconds; <= 0 means free. */
  private readonly life = new Float32Array(MAX);
  private readonly maxLife = new Float32Array(MAX);
  private readonly baseColor: THREE.Color[] = [];
  private cursor = 0;
  private readonly tmpColor = new THREE.Color();

  constructor(private readonly scene: THREE.Scene) {
    this.positions = new Float32Array(MAX * 3);
    this.colors = new Float32Array(MAX * 3);
    for (let i = 0; i < MAX; i++) {
      this.positions[i * 3 + 1] = -1000;
      this.baseColor.push(new THREE.Color());
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.material = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  /** Small spark burst, e.g. when a piece snaps home. */
  burst(pos: THREE.Vector3, color: number, count = 14, speed = 3.2): void {
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % MAX;
      const i3 = i * 3;
      this.positions[i3] = pos.x;
      this.positions[i3 + 1] = pos.y;
      this.positions[i3 + 2] = pos.z;
      // Random direction with upward bias.
      const theta = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.35;
      const r = Math.sqrt(Math.max(0, 1 - up * up));
      const s = speed * (0.5 + Math.random() * 0.7);
      this.velocities[i3] = Math.cos(theta) * r * s;
      this.velocities[i3 + 1] = up * s;
      this.velocities[i3 + 2] = Math.sin(theta) * r * s;
      this.maxLife[i] = this.life[i] = 0.5 + Math.random() * 0.4;
      this.baseColor[i].setHex(color);
    }
  }

  /** Multi-color celebration above the finished shape. */
  confetti(center: THREE.Vector3, accent: number): void {
    const palette = [accent, 0xffffff, 0xffd166, 0x6ee7b7, 0x93c5fd];
    for (let b = 0; b < 5; b++) {
      const off = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        2 + Math.random() * 2.5,
        (Math.random() - 0.5) * 4
      ).add(center);
      this.burst(off, palette[b % palette.length], 26, 4.5);
    }
  }

  /** Integrate physics; call once per frame with seconds since last frame. */
  update(dt: number): void {
    if (dt <= 0) return;
    let any = false;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const i3 = i * 3;
      if (this.life[i] <= 0) {
        this.positions[i3 + 1] = -1000;
        this.colors[i3] = this.colors[i3 + 1] = this.colors[i3 + 2] = 0;
        continue;
      }
      this.velocities[i3 + 1] += GRAVITY * dt;
      this.positions[i3] += this.velocities[i3] * dt;
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt;
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt;
      // Fade to black over the particle's life.
      const f = this.life[i] / this.maxLife[i];
      this.tmpColor.copy(this.baseColor[i]).multiplyScalar(f * f);
      this.colors[i3] = this.tmpColor.r;
      this.colors[i3 + 1] = this.tmpColor.g;
      this.colors[i3 + 2] = this.tmpColor.b;
    }
    if (any) {
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
    }
  }

  dispose(): void {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}
