export type Ease = (t: number) => number;

export const linear: Ease = (t) => t;
export const cubicOut: Ease = (t) => 1 - Math.pow(1 - t, 3);
export const quintOut: Ease = (t) => 1 - Math.pow(1 - t, 5);
export const backOut: Ease = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
/** 0→1→0 hump, for pulses. */
export const bump: Ease = (t) => Math.sin(t * Math.PI);

export interface TweenHandle {
  cancel(): void;
}

interface ActiveTween {
  start: number;
  duration: number;
  ease: Ease;
  onUpdate: (t: number) => void;
  onComplete?: () => void;
  cancelled: boolean;
}

let active: ActiveTween[] = [];

export function tween(opts: {
  duration: number;
  delay?: number;
  ease?: Ease;
  onUpdate: (t: number) => void;
  onComplete?: () => void;
}): TweenHandle {
  const tw: ActiveTween = {
    start: performance.now() + (opts.delay ?? 0),
    duration: opts.duration,
    ease: opts.ease ?? cubicOut,
    onUpdate: opts.onUpdate,
    onComplete: opts.onComplete,
    cancelled: false,
  };
  active.push(tw);
  return {
    cancel() {
      tw.cancelled = true;
    },
  };
}

/** Drive all tweens; call once per frame with the rAF timestamp. */
export function updateTweens(now: number): void {
  if (active.length === 0) return;
  const keep: ActiveTween[] = [];
  // Iterate over a snapshot: onUpdate/onComplete may add new tweens.
  const batch = active;
  active = keep;
  for (const tw of batch) {
    if (tw.cancelled) continue;
    if (now < tw.start) {
      keep.push(tw);
      continue;
    }
    const p = tw.duration <= 0 ? 1 : Math.min(1, (now - tw.start) / tw.duration);
    tw.onUpdate(tw.ease(p));
    if (p >= 1) tw.onComplete?.();
    else keep.push(tw);
  }
}
