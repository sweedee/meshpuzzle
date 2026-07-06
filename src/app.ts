import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Game } from './game';
import type { DragControls } from './controls';
import type { Effects } from './effects';
import type { SoundFX } from './audio';
import { LEVELS, levelById, levelIndex, type LevelDef } from './levels';
import { computeStars, nextStarHint, starThresholds } from './score';
import { getSave, levelResult, recordResult, resetProgress, updateSettings } from './save';
import type { UI, TileInfo } from './ui';

export type ScreenState = 'menu' | 'playing' | 'won';

export interface AppContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  orbit: OrbitControls;
  drag: DragControls;
  effects: Effects;
  audio: SoundFX;
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
    ui.onTap = () => ctx.audio.tap();
    ui.onSettingsChange = (s) => {
      updateSettings(s);
      ctx.audio.setSfx(s.sfx);
      ctx.audio.setAmbient(s.ambient);
    };
    ui.onResetProgress = () => {
      if (!window.confirm('Wipe all level progress and best scores?')) return;
      resetProgress();
      if (this.state === 'menu') this.ui.showMenu(this.menuTiles());
    };
    ui.setSettings(getSave().settings);

    ctx.drag.onGrab = () => {
      if (this.state !== 'playing') return;
      ctx.audio.grab();
      this.session.started = true;
      if (this.session.runningSince === null) this.session.runningSince = performance.now();
    };
    ctx.drag.onRelease = (_piece, placed) => {
      if (this.state !== 'playing') return;
      if (!placed) ctx.audio.deny();
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
    this.ctx.orbit.autoRotate = false;
    this.ui.showGame(level);
    this.ui.setCount(this.game!.placed, this.game!.total);
    this.ui.setTimer(0);
    this.ui.setMoves(0);
    // Input opens up once the scatter-in animation lands.
    this.ctx.drag.enabled = false;
    this.game!.scatter(true, () => {
      if (this.state === 'playing') this.ctx.drag.enabled = true;
    });
  }

  resetLevel(): void {
    if (!this.game || this.state !== 'playing') return;
    this.session = { started: false, moves: 0, elapsedMs: 0, runningSince: null };
    this.ui.setTimer(0);
    this.ui.setMoves(0);
    this.ctx.drag.enabled = false;
    this.game.reset(true, () => {
      if (this.state === 'playing') this.ctx.drag.enabled = true;
    });
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
    // Level i unlocks once level i-1 is completed.
    let prevCompleted = true;
    return LEVELS.map((level) => {
      const result = levelResult(level.id);
      const locked = !prevCompleted;
      prevCompleted = result?.completed ?? false;
      return {
        level,
        locked,
        stars: result?.stars ?? 0,
        completed: result?.completed ?? false,
      };
    });
  }

  private loadLevel(level: LevelDef): void {
    const { scene, orbit, drag, sun } = this.ctx;

    drag.setGame(null);
    this.game?.dispose();

    this.level = level;
    this.game = new Game(scene, level, this.ctx.gridOverride);
    this.game.onChange = () => this.ui.setCount(this.game!.placed, this.game!.total);
    this.game.onWin = () => this.handleWin();
    this.game.onPlace = (piece) => {
      if (this.state !== 'playing') return;
      this.ctx.effects.burst(piece.home, level.theme.ghost);
      this.ctx.audio.snap();
    };

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
    this.game!.celebrate();
    this.ctx.effects.confetti(this.game!.latticeCenter, this.level.theme.ghost);
    this.ctx.audio.fanfare();
    const timeMs = this.elapsedMs();
    this.ui.setTimer(timeMs);

    const moves = this.session.moves;
    const t = starThresholds(this.level, this.game!.total);
    const stars = computeStars(t, timeMs, moves);
    const { improved, prev } = recordResult(this.level.id, { timeMs, moves, stars });

    // Star chimes timed to the CSS pop-in animation.
    for (let i = 1; i <= stars; i++) {
      window.setTimeout(() => this.ctx.audio.star(i), 240 + i * 260);
    }

    const sub: string[] = [];
    if (improved && prev) sub.push('New best!');
    const hint = nextStarHint(t, stars);
    if (hint) sub.push(hint);

    this.ui.showWin({
      stars,
      timeMs,
      moves,
      sub: sub.join(' · ') || undefined,
      hasNext: levelIndex(this.level.id) < LEVELS.length - 1,
    });
  }
}
