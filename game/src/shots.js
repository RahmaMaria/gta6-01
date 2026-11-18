// The screenshot scenes behind ?shot=start|play|chase|end. Each one plays the
// real rules forward from a fresh engine for a fixed number of steps, steered
// by a road-following autopilot (drive to the target's road, turn, drive along
// it), so the frame is what a short game really looks like and the same seed
// always gives the same frame.

import { STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './engine.js';
import { addWanted } from './wanted.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 16;
const CHASE_SECONDS = 8;
const END_LIMIT_SECONDS = 90;

/** A silent stand-in for the audio system: screenshots make no sound. */
export const silentAudio = {
  shoot() {}, thugShoot() {}, hit() {}, pickup() {}, mission() {}, crash() {},
  click() {}, victory() {}, gameOver() {}, unlock() {}, toggleMute() { return true; },
  update() {}, get muted() { return true; },
};

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function nearestLine(list, v) {
  let best = list[0];
  let bestD = Infinity;
  for (const line of list) {
    const d = Math.abs(line - v);
    if (d < bestD) {
      bestD = d;
      best = line;
    }
  }
  return best;
}

/**
 * Drive the player's car toward the current mission marker along the road
 * grid: to the target's row, along it, then to the marker. The car steers
 * toward a waypoint point on a road centre line — not a bare heading — so a
 * turn that overshoots is pulled back onto the road instead of grinding
 * along a building face. On foot it walks straight at the marker and fires
 * at the nearest thug.
 */
export function driveAutopilot(state) {
  const player = state.player;
  const markerKey = ['garage', 'docks', 'safehouse', 'exchange', 'yacht'][state.mission.index];
  const marker = state.city.markers[markerKey] ?? { x: 1280, y: 960 };
  const tx = marker.x;
  const ty = marker.y;

  if (player.onFoot) {
    const dx = tx - player.x;
    const dy = ty - player.y;
    const d = Math.hypot(dx, dy) || 1;
    let aimAngle = -Math.PI / 2;
    let firing = false;
    let nearest = null;
    let nearestD = Infinity;
    for (const thug of state.thugs) {
      const td = Math.hypot(thug.x - player.x, thug.y - player.y);
      if (td < nearestD) {
        nearestD = td;
        nearest = thug;
      }
    }
    if (nearest) {
      aimAngle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
      firing = nearestD < 420;
    }
    return {
      move: { x: dx / d, y: dy / d },
      aimAngle,
      firing,
      enterPressed: false,
    };
  }

  const car = state.cars.find((c) => c.id === player.carId);
  if (!car) {
    return { move: { x: 0, y: 0 }, aimAngle: -Math.PI / 2, firing: false, enterPressed: false };
  }
  const city = state.city;
  const vLine = nearestLine(city.vertical, car.x);
  const hLine = nearestLine(city.horizontal, car.y);
  const onVertical = Math.abs(car.x - vLine) < 70;
  const onHorizontal = Math.abs(car.y - hLine) < 70;
  const col = nearestLine(city.vertical, tx);
  const row = nearestLine(city.horizontal, ty);

  // The next waypoint: a point on a road centre line. While driving along a
  // road it sits only a short way ahead on the centre line, so the car is
  // pulled back to the middle of the road instead of cruising its edge
  // (where the sidewalk walkers are).
  const AHEAD = 220;
  let wx;
  let wy;
  if (onVertical && !onHorizontal) {
    if (Math.abs(tx - vLine) < 70) {
      // Same column as the target: drive along it to the target's height.
      wx = vLine;
      wy = car.y + AHEAD * Math.sign(ty - car.y);
    } else if (Math.abs(car.y - row) < 40) {
      // Reached the target's row: turn onto it and drive along it.
      wx = tx;
      wy = row;
    } else {
      // Drive along this road to the target's row.
      wx = vLine;
      wy = car.y + AHEAD * Math.sign(row - car.y);
    }
  } else if (onHorizontal && !onVertical) {
    if (Math.abs(ty - hLine) < 70) {
      wx = car.x + AHEAD * Math.sign(tx - car.x);
      wy = hLine;
    } else if (Math.abs(car.x - col) < 40) {
      wx = col;
      wy = ty;
    } else {
      wx = car.x + AHEAD * Math.sign(col - car.x);
      wy = hLine;
    }
  } else if (onVertical && onHorizontal) {
    // On an intersection: take the axis with the bigger gap left.
    if (Math.abs(tx - car.x) > Math.abs(ty - car.y)) {
      wx = tx;
      wy = hLine;
    } else {
      wx = vLine;
      wy = ty;
    }
  } else {
    // Off the roads: head for the nearest road point.
    if (Math.abs(car.x - vLine) < Math.abs(car.y - hLine)) {
      wx = vLine;
      wy = car.y;
    } else {
      wx = car.x;
      wy = hLine;
    }
  }
  const dx = wx - car.x;
  const dy = wy - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const desired = Math.atan2(dy, dx);
  const diff = angleDiff(desired, car.angle);
  const steer = clamp(diff * 1.8, -1, 1);
  // Cruise gently and slow right down near a waypoint: a slow car makes its
  // turns inside the road instead of grinding along building corners.
  const throttle = Math.abs(diff) > 1.0 ? 0.25 : dist < 130 ? 0.35 : 0.5;
  return {
    move: { x: steer, y: -throttle },
    aimAngle: car.angle,
    firing: false,
    enterPressed: false,
  };
}

/** Put the player in the given car (teleporting the car there first). */
function putPlayerInCar(state, car, x, y, angle) {
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = 0;
  car.kind = 'player';
  state.player.carId = car.id;
  state.player.onFoot = false;
  state.player.x = x;
  state.player.y = y;
}

/**
 * Set `engine` to the named scene (start, play, chase or end; any other name
 * is start) and return the screen to draw over it and the best cash to show.
 */
export function stageShot(name, engine) {
  const state = engine.state;
  if (name !== 'play' && name !== 'chase' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      engine.step(STEP, { move: { x: 0, y: 0 }, aimAngle: -Math.PI / 2, firing: false, enterPressed: false }, silentAudio, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'play') {
    state.mission.index = 1;
    state.mission.elapsed = 0;
    const pink = state.cars.find((c) => c.kind === 'parked' && c.color === '#ff2e88') ?? state.cars[0];
    // Start on the road itself (x=480), heading south toward the docks.
    putPlayerInCar(state, pink, 480, 430, Math.PI / 2);
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      const events = engine.step(STEP, driveAutopilot(state), silentAudio, false);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    return { screen: SCREEN_PLAY, best: state.player.cash };
  }

  if (name === 'chase') {
    state.mission.index = 4;
    state.mission.elapsed = 0;
    addWanted(state.wanted, 3);
    const car = state.cars.find((c) => c.kind === 'parked') ?? state.cars[0];
    // Start at the garage corner, far from the yacht: the whole chase is the drive.
    putPlayerInCar(state, car, 480, 480, Math.PI / 2);
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      const events = engine.step(STEP, driveAutopilot(state), silentAudio, false);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    return { screen: SCREEN_PLAY, best: state.player.cash };
  }

  // end: the final run — from the garage corner all the way to the yacht,
  // the whole last job, and take the bay.
  state.mission.index = 4;
  state.mission.elapsed = 0;
  const car = state.cars.find((c) => c.kind === 'parked') ?? state.cars[0];
  putPlayerInCar(state, car, 480, 480, Math.PI / 2);
  let won = false;
  for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
    const events = engine.step(STEP, driveAutopilot(state), silentAudio, false);
    if (events & EVENT_WIN) {
      won = true;
      break;
    }
    if (events & EVENT_OVER) break;
  }
  return { screen: won ? SCREEN_WIN : SCREEN_OVER, best: state.player.cash };
}
