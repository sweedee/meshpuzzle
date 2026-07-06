import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Game } from './game';
import type { DragControls } from './controls';
import { levelById, type LevelDef } from './levels';

export interface AppContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  orbit: OrbitControls;
  drag: DragControls;
  sun: THREE.DirectionalLight;
  /** Debug ?grid=WxHxD override applied to whichever level loads. */
  gridOverride?: THREE.Vector3;
}

export class App {
  game: Game | null = null;
  level: LevelDef | null = null;

  /** Rewire HUD/callbacks whenever a level is (re)built. */
  onLevelLoaded: (game: Game) => void = () => {};

  constructor(private readonly ctx: AppContext) {}

  startLevel(id: string): void {
    const level = levelById(id);
    if (!level) throw new Error(`Unknown level: ${id}`);
    const { scene, orbit, drag, sun } = this.ctx;

    drag.setGame(null);
    this.game?.dispose();

    this.level = level;
    this.game = new Game(scene, level, this.ctx.gridOverride);

    // Theme the scene.
    (scene.background as THREE.Color).setHex(level.theme.bg);
    (scene.fog as THREE.Fog).color.setHex(level.theme.bg);
    sun.color.setHex(level.theme.sun);
    document.documentElement.style.setProperty('--accent', level.theme.accent);

    orbit.target.copy(this.game.latticeCenter);
    orbit.maxDistance = Math.max(30, this.game.scatterRadius * 2.4);

    drag.setGame(this.game);
    this.onLevelLoaded(this.game);
  }
}
