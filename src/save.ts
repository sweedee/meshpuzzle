export interface LevelResult {
  completed: boolean;
  stars: number;
  bestTimeMs: number;
  bestMoves: number;
}

export interface Settings {
  sfx: boolean;
  ambient: boolean;
}

export interface SaveData {
  version: 1;
  levels: Record<string, LevelResult>;
  settings: Settings;
}

const KEY = 'meshpuzzle.v1';

function defaults(): SaveData {
  return { version: 1, levels: {}, settings: { sfx: true, ambient: false } };
}

// localStorage can throw (private-mode Safari, disabled storage) and its
// contents can be garbage — everything below survives both, falling back to
// an in-memory save for the session.
function read(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const data = JSON.parse(raw) as SaveData;
    if (data?.version !== 1 || typeof data.levels !== 'object' || !data.levels) return defaults();
    return { ...defaults(), ...data, settings: { ...defaults().settings, ...data.settings } };
  } catch {
    return defaults();
  }
}

let state = read();

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable; keep the in-memory copy.
  }
}

export function getSave(): SaveData {
  return state;
}

export function levelResult(id: string): LevelResult | undefined {
  return state.levels[id];
}

export interface RunResult {
  timeMs: number;
  moves: number;
  stars: number;
}

/** Merge a finished run into the save, keeping bests. */
export function recordResult(
  id: string,
  run: RunResult
): { improved: boolean; prev: LevelResult | undefined } {
  const prev = state.levels[id];
  const merged: LevelResult = prev
    ? {
        completed: true,
        stars: Math.max(prev.stars, run.stars),
        bestTimeMs: Math.min(prev.bestTimeMs, run.timeMs),
        bestMoves: Math.min(prev.bestMoves, run.moves),
      }
    : { completed: true, stars: run.stars, bestTimeMs: run.timeMs, bestMoves: run.moves };
  state.levels[id] = merged;
  persist();
  const improved =
    !prev ||
    run.stars > prev.stars ||
    run.timeMs < prev.bestTimeMs ||
    run.moves < prev.bestMoves;
  return { improved, prev };
}

export function updateSettings(patch: Partial<Settings>): Settings {
  state.settings = { ...state.settings, ...patch };
  persist();
  return state.settings;
}

/** Wipe level progress but keep settings. */
export function resetProgress(): void {
  state = { ...defaults(), settings: state.settings };
  persist();
}
