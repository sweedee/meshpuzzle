import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Game } from './game';
import type { DragControls } from './controls';
import { LEVELS, levelById, levelIndex, type LevelDef } from './levels';
import type { UI, TileInfo } from './ui';

export type ScreenState = 'menu' | 'playing' | 'won';

export interface AppContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  orbit: OrbitControls;
  drag: DragControls;
  sun: THREE.DirectionalLight;
  /** Debug ?grid=WxHxD override applied to whichever level loads. */
  gridOverride?: THREE.Vector3;
}

interface Session {
  started: boolean;
  moves: number;
  elapsedMs: number;
  runningSince: number | null;
}

const TIMER_REFRESH_MS = 250;

export class App {
  game: Game | null = null;
  level: LevelDef | null = null;
  state: ScreenState = 'menu';

  private session: Session = { started: false, moves: 0, elapsedMs: 0, runningSince: null };
  private resumeOnVisible = false;
  private lastTimerRefresh = 0;

  constructor(
    private readonly ctx: AppContext,
    private readonly ui: UI
  ) {
    ui.onLevelSelect = (id) => this.startLevel(id);
    ui.onMenu = () => this.showMenu();
    ui.onReset = () => this.resetLevel();
    ui.onReplay = () => this.level && this.startLevel(this.level.id);
    ui.onNext = () => {
      const next = this.level && LEVELS[levelIndex(this.level.id) + 1];
      if (next) this.startLevel(next.id);
    };

    ctx.drag.onGrab = () => {
      if (this.state !== 'playing') return;
      this.session.started = true;
      if (this.session.runningSince === null) this.session.runningSince = performance.now();
    };
    ctx.drag.onRelease = () => {
      if (this.state !== 'playing') return;
      this.session.moves++;
      this.ui.setMoves(this.session.moves);
    };

    // Pause the clock while the tab is hidden so star times stay honest.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.resumeOnVisible = this.session.runningSince !== null;
        this.pauseClock();
      } else if (this.resumeOnVisible && this.state === 'playing') {
        this.session.runningSince = performance.now();
        this.resumeOnVisible = false;
      }
    });
  }

  /** Show the title menu over a slowly orbiting solved-shape backdrop. */
  showMenu(): void {
    this.state = 'menu';
    this.pauseClock();
    this.ctx.drag.enabled = false;
    this.ctx.orbit.autoRotate = true;
    this.ctx.orbit.autoRotateSpeed = 0.6;
    if (!this.game) {
      this.loadLevel(levelById('teapot')!);
      this.game!.solve();
    }
    this.ui.showMenu(this.menuTiles());
  }

  startLevel(id: string): void {
    const level = levelById(id);
    if (!level) throw new Error(`Unknown level: ${id}`);
    this.loadLevel(level);
    this.state = 'playing';
    this.session = { started: false, moves: 0, elapsedMs: 0, runningSince: null };
    this.ctx.drag.enabled = true;
    this.ctx.orbit.autoRotate = false;
    this.ui.showGame(level);
    this.ui.setCount(this.game!.placed, this.game!.total);
    this.ui.setTimer(0);
    this.ui.setMoves(0);
  }

  resetLevel(): void {
    if (!this.game || this.state !== 'playing') return;
    this.game.reset();
    this.session = { started: false, moves: 0, elapsedMs: 0, runningSince: null };
    this.ui.setTimer(0);
    this.ui.setMoves(0);
  }

  /** Milliseconds on the level clock (starts at the first grab). */
  elapsedMs(): number {
    const { elapsedMs, runningSince } = this.session;
    return elapsedMs + (runningSince !== null ? performance.now() - runningSince : 0);
  }

  /** Called every frame; throttles HUD timer updates. */
  tick(now: number): void {
    if (this.state !== 'playing' || !this.session.started) return;
    if (now - this.lastTimerRefresh < TIMER_REFRESH_MS) return;
    this.lastTimerRefresh = now;
    this.ui.setTimer(this.elapsedMs());
  }

  private pauseClock(): void {
    if (this.session.runningSince !== null) {
      this.session.elapsedMs += performance.now() - this.session.runningSince;
      this.session.runningSince = null;
    }
  }

  private menuTiles(): TileInfo[] {
    // Progression/stars arrive with the save system; everything open for now.
    return LEVELS.map((level) => ({ level, locked: false, stars: 0, completed: false }));
  }

  private loadLevel(level: LevelDef): void {
    const { scene, orbit, drag, sun } = this.ctx;

    drag.setGame(null);
    this.game?.dispose();

    this.level = level;
    this.game = new Game(scene, level, this.ctx.gridOverride);
    this.game.onChange = () => this.ui.setCount(this.game!.placed, this.game!.total);
    this.game.onWin = () => this.handleWin();

    // Theme the scene.
    (scene.background as THREE.Color).setHex(level.theme.bg);
    (scene.fog as THREE.Fog).color.setHex(level.theme.bg);
    sun.color.setHex(level.theme.sun);
    document.documentElement.style.setProperty('--accent', level.theme.accent);

    orbit.target.copy(this.game.latticeCenter);
    orbit.maxDistance = Math.max(30, this.game.scatterRadius * 2.4);

    drag.setGame(this.game);
  }

  private handleWin(): void {
    if (this.state !== 'playing' || !this.level) return;
    this.state = 'won';
    this.pauseClock();
    this.ctx.orbit.autoRotate = true;
    this.ctx.orbit.autoRotateSpeed = 1.2;
    this.ctx.drag.enabled = false;
    const timeMs = this.elapsedMs();
    this.ui.setTimer(timeMs);
    this.ui.showWin({
      timeMs,
      moves: this.session.moves,
      hasNext: levelIndex(this.level.id) < LEVELS.length - 1,
    });
  }
}
