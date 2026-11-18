// The wanted level: 0 to 5 stars. Crimes raise it and restart the heat timer;
// while the heat is on, police spawn up to the star count and chase. When the
// heat cools with no fresh crime, the stars tick down one at a time and the
// police give up. The engine owns the police cars; this module only decides
// how many there should be.

import { WANTED } from './config.js';

export function createWanted() {
  return { level: 0, heat: 0, calm: 0 };
}

export function addWanted(wanted, amount) {
  wanted.level = Math.min(WANTED.max, wanted.level + amount);
  wanted.heat = WANTED.heatAfterCrime;
  wanted.calm = 0;
}

/**
 * One step. Returns the number of police cars that should be out right now.
 * `policeNear` is true when a police car is close enough to see the player —
 * the heat does not cool while the law is watching.
 */
export function stepWanted(wanted, dt, policeNear) {
  if (wanted.heat > 0) {
    wanted.heat -= dt;
    if (wanted.heat <= 0 && wanted.level > 0) {
      wanted.calm = WANTED.decayAfterCalm;
    }
  } else if (wanted.level > 0 && !policeNear) {
    wanted.calm -= dt;
    if (wanted.calm <= 0) {
      wanted.level -= 1;
      wanted.calm = wanted.level > 0 ? WANTED.decayAfterCalm : 0;
    }
  }
  return wanted.level;
}

/** Stars as a string for the HUD: filled and empty, five in all. */
export function wantedStars(wanted) {
  let out = '';
  for (let i = 0; i < WANTED.max; i += 1) out += i < wanted.level ? '★' : '☆';
  return out;
}
