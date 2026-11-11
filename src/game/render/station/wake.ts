/**
 * The station waking up once the machine room has power: seconds after the cable goes in
 * at which each part comes alive, one after another. Only what the player sees and hears;
 * the logic (src/game/sim/station.ts) knows just `machinePowered` and `poweredT`.
 */
export const WAKE = { machine: 0, storage: 2.2, duty: 3.0, workshop: 3.8, hall: 4.6, doors: 5.4, yard: 6.6 } as const;
export type WakePart = keyof typeof WAKE;
/** Rooms in the order they light up (for the hum that goes with each). */
export const WAKE_ROOMS: WakePart[] = ['storage', 'duty', 'workshop', 'hall', 'doors', 'yard'];

/** 0..1 brightness of a part: a stutter of the old tubes, then steady. `k` staggers lamps of one part. */
export function wake(poweredT: number, part: WakePart, k = 0): number {
  const u = poweredT - WAKE[part] - k * 0.22;
  if (u <= 0) return 0;
  const level = Math.min(1, u / 1.1);
  // tubes catching: off-on-off in the first moments, the same every time
  const stutter = u < 0.75 ? (Math.sin(u * 53 + k * 7) > 0.15 ? 1 : 0.18) : 1;
  return level * stutter;
}
