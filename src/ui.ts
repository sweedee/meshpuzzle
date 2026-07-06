import type { LevelDef } from './levels';

export interface TileInfo {
  level: LevelDef;
  locked: boolean;
  /** 0–3; shown on completed tiles. */
  stars: number;
  completed: boolean;
}

export interface WinInfo {
  /** 1–3 when scoring is active; omit to hide the star row. */
  stars?: number;
  timeMs: number;
  moves: number;
  /** Secondary line, e.g. "New best!" or next-star thresholds. */
  sub?: string;
  hasNext: boolean;
}

export interface SettingsState {
  sfx: boolean;
  ambient: boolean;
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function el<T extends HTMLElement>(sel: string): T {
  const node = document.querySelector<T>(sel);
  if (!node) throw new Error(`Missing element: ${sel}`);
  return node;
}

/** All DOM: screens, HUD, level grid, settings, win overlay. */
export class UI {
  onLevelSelect: (id: string) => void = () => {};
  onMenu: () => void = () => {};
  onReset: () => void = () => {};
  onReplay: () => void = () => {};
  onNext: () => void = () => {};
  onSettingsChange: (s: SettingsState) => void = () => {};
  onResetProgress: () => void = () => {};
  /** Any button press (audio hook). */
  onTap: () => void = () => {};

  private readonly hud = el('#hud');
  private readonly menu = el('#menu');
  private readonly settings = el('#settings');
  private readonly win = el('#win');
  private readonly hint = el('#hint');
  private readonly levelGrid = el('#level-grid');
  private readonly levelName = el('#level-name');
  private readonly count = el('#count');
  private readonly timer = el('#timer');
  private readonly moves = el('#moves');
  private readonly stars = el('#stars');
  private readonly winStats = el('#win-stats');
  private readonly winSub = el('#win-sub');
  private readonly winNext = el<HTMLButtonElement>('#win-next');
  private readonly optSfx = el<HTMLInputElement>('#opt-sfx');
  private readonly optAmbient = el<HTMLInputElement>('#opt-ambient');
  private hintTimer = 0;

  constructor() {
    const tap = (sel: string, fn: () => void) =>
      el(sel).addEventListener('click', () => {
        this.onTap();
        fn();
      });
    tap('#menu-btn', () => this.onMenu());
    tap('#reset', () => this.onReset());
    tap('#win-levels', () => this.onMenu());
    tap('#win-replay', () => this.onReplay());
    tap('#win-next', () => this.onNext());
    tap('#settings-btn', () => this.settings.classList.remove('hidden'));
    tap('#settings-close', () => this.settings.classList.add('hidden'));
    tap('#reset-progress', () => this.onResetProgress());
    const emitSettings = () =>
      this.onSettingsChange({ sfx: this.optSfx.checked, ambient: this.optAmbient.checked });
    this.optSfx.addEventListener('change', emitSettings);
    this.optAmbient.addEventListener('change', emitSettings);
  }

  showMenu(tiles: TileInfo[]): void {
    this.buildLevelGrid(tiles);
    this.menu.classList.remove('hidden');
    this.win.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.hideHint();
  }

  showGame(level: LevelDef): void {
    this.menu.classList.add('hidden');
    this.win.classList.add('hidden');
    this.settings.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.levelName.textContent = `${level.icon} ${level.name}`;
    if (level.hint) this.showHint(level.hint);
    else this.hideHint();
  }

  showWin(info: WinInfo): void {
    this.win.classList.remove('hidden');
    if (info.stars === undefined) {
      this.stars.classList.add('hidden');
    } else {
      this.stars.classList.remove('hidden');
      this.stars.innerHTML = [1, 2, 3]
        .map((n) => `<span class="${n <= info.stars! ? '' : 'dim'}">★</span>`)
        .join('');
    }
    this.winStats.textContent = `Time ${formatTime(info.timeMs)} · Moves ${info.moves}`;
    this.winSub.textContent = info.sub ?? '';
    this.winNext.classList.toggle('hidden', !info.hasNext);
  }

  setCount(placed: number, total: number): void {
    this.count.textContent = `${placed} / ${total}`;
  }

  setTimer(ms: number): void {
    this.timer.textContent = formatTime(ms);
  }

  setMoves(n: number): void {
    this.moves.textContent = `${n} ↔`;
  }

  setSettings(s: SettingsState): void {
    this.optSfx.checked = s.sfx;
    this.optAmbient.checked = s.ambient;
  }

  private showHint(text: string): void {
    window.clearTimeout(this.hintTimer);
    this.hint.textContent = text;
    this.hint.classList.remove('hidden', 'faded');
    this.hintTimer = window.setTimeout(() => this.hint.classList.add('faded'), 6000);
  }

  private hideHint(): void {
    window.clearTimeout(this.hintTimer);
    this.hint.classList.add('hidden');
  }

  private buildLevelGrid(tiles: TileInfo[]): void {
    this.levelGrid.textContent = '';
    for (const t of tiles) {
      const btn = document.createElement('button');
      btn.className = 'tile';
      if (t.locked) btn.classList.add('locked');
      if (t.completed) btn.classList.add('done');
      btn.disabled = t.locked;
      const starText = t.completed ? '★'.repeat(t.stars) + '☆'.repeat(3 - t.stars) : '';
      btn.innerHTML =
        `<span class="tile-icon">${t.locked ? '🔒' : t.level.icon}</span>` +
        `<span class="tile-name">${t.level.name}</span>` +
        `<span class="tile-stars">${starText}</span>`;
      btn.addEventListener('click', () => {
        if (t.locked) return;
        this.onTap();
        this.onLevelSelect(t.level.id);
      });
      this.levelGrid.appendChild(btn);
    }
  }
}
