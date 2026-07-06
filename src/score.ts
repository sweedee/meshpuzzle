import type { LevelDef } from './levels';
import { formatTime } from './ui';

export interface StarThresholds {
  threeTimeMs: number;
  threeMoves: number;
  twoTimeMs: number;
  twoMoves: number;
}

/**
 * Star budgets scale with the actual piece count (the slicer drops sliver
 * cells, so counts are only known after slicing).
 */
export function starThresholds(level: LevelDef, pieceCount: number): StarThresholds {
  return {
    threeTimeMs: level.timePar * pieceCount * 1000,
    threeMoves: Math.ceil(level.movePar * pieceCount),
    twoTimeMs: 2 * level.timePar * pieceCount * 1000,
    twoMoves: Math.ceil(2.5 * pieceCount),
  };
}

/** Both the time and move budget must hold for each star tier. */
export function computeStars(t: StarThresholds, timeMs: number, moves: number): number {
  if (timeMs <= t.threeTimeMs && moves <= t.threeMoves) return 3;
  if (timeMs <= t.twoTimeMs && moves <= t.twoMoves) return 2;
  return 1;
}

/** Win-screen hint showing what the next star tier requires. */
export function nextStarHint(t: StarThresholds, stars: number): string | undefined {
  if (stars >= 3) return undefined;
  const [timeMs, moves] = stars === 2 ? [t.threeTimeMs, t.threeMoves] : [t.twoTimeMs, t.twoMoves];
  return `${stars + 1}★: under ${formatTime(timeMs)} and ≤ ${moves} moves`;
}
