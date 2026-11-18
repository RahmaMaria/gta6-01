// The player: on foot, a kid with a pistol and fast legs; in a car, a driver
// with throttle, brake and steering. E gets in and out of cars. Stealing a
// moving traffic car is grand theft auto and the law notices; the parked cars
// by the garage are Vic's and cost nothing. Shooting is on foot only, aimed
// with the mouse.

import { CAR, CITY, PLAYER, WANTED, WATER_Y } from './config.js';
import { collideBuildings } from './city.js';
import { driveCar, moveCar } from './vehicles.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: -Math.PI / 2,
    vx: 0,
    vy: 0,
    health: PLAYER.health,
    cash: 0,
    onFoot: true,
    carId: null,
    aimAngle: -Math.PI / 2,
    fireCd: 0,
    invulnerable: 0,
  };
}

/**
 * One step. `drive` is { move, aimAngle, firing, enterPressed }. `fns` is the
 * engine's helpers: fireBullet, crime, audio, spark (particles) and text
 * (floating labels). Returns the car the player is driving, or null.
 */
export function stepPlayer(state, city, drive, dt, fns) {
  const player = state.player;
  if (player.fireCd > 0) player.fireCd -= dt;
  if (player.invulnerable > 0) player.invulnerable -= dt;

  if (player.onFoot) {
    stepOnFoot(state, city, drive, dt, fns);
    return null;
  }
  const car = state.cars.find((c) => c.id === player.carId);
  if (!car) {
    player.onFoot = true;
    player.carId = null;
    return null;
  }
  return stepDriving(state, city, car, drive, dt, fns);
}

function stepOnFoot(state, city, drive, dt, fns) {
  const player = state.player;
  player.aimAngle = drive.aimAngle;
  player.vx += drive.move.x * PLAYER.accel * dt;
  player.vy += drive.move.y * PLAYER.accel * dt;
  // Friction: legs stop quickly when no key is held.
  player.vx -= player.vx * 8 * dt;
  player.vy -= player.vy * 8 * dt;
  const speed = Math.hypot(player.vx, player.vy);
  if (speed > PLAYER.walkSpeed) {
    player.vx = (player.vx / speed) * PLAYER.walkSpeed;
    player.vy = (player.vy / speed) * PLAYER.walkSpeed;
  }
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  if (speed > 40) player.angle = Math.atan2(player.vy, player.vx);
  const resolved = collideBuildings(city, player.x, player.y, PLAYER.radius);
  player.x = resolved.x;
  player.y = resolved.y;
  player.x = Math.max(24, Math.min(CITY.width - 24, player.x));
  player.y = Math.max(24, Math.min(WATER_Y - 20, player.y));

  if (drive.enterPressed) tryEnterCar(state, fns);
  if (drive.firing && player.fireCd <= 0) {
    player.fireCd = PLAYER.fireInterval;
    const bx = player.x + Math.cos(player.aimAngle) * 20;
    const by = player.y + Math.sin(player.aimAngle) * 20;
    fns.fireBullet(bx, by, player.aimAngle, 'player');
    fns.audio.shoot();
    fns.spark(bx, by, '#ffe9a8', 4);
  }
}

function stepDriving(state, city, car, drive, dt, fns) {
  const player = state.player;
  const throttle = -drive.move.y; // up is forward
  const steer = drive.move.x;
  const skid = driveCar(car, throttle, steer, dt);
  const crashed = moveCar(car, city, dt);
  if (crashed && Math.abs(car.speed) > 200) {
    fns.audio.crash();
    fns.spark(car.x, car.y, '#ffb347', 10);
  }
  if (skid) {
    fns.spark(car.x - Math.cos(car.angle) * 16, car.y - Math.sin(car.angle) * 16, '#8b93a3', 1);
  }
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.vx = Math.cos(car.angle) * car.speed;
  player.vy = Math.sin(car.angle) * car.speed;
  if (drive.enterPressed) exitCar(state, car, fns);
  return car;
}

function tryEnterCar(state, fns) {
  const player = state.player;
  let best = null;
  let bestD = 78;
  for (const car of state.cars) {
    if (car.kind === 'police') continue; // police cars are locked
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return;
  if (best.kind === 'traffic') {
    fns.crime(WANTED.stealCar);
    fns.text(player.x, player.y - 30, 'GRAND THEFT AUTO +★');
    fns.audio.pickup();
  } else {
    fns.audio.pickup();
  }
  best.kind = 'player';
  player.carId = best.id;
  player.onFoot = false;
}

function exitCar(state, car, fns) {
  const player = state.player;
  // Step out on the driver's side, clear of the body.
  const side = car.angle + Math.PI / 2;
  player.x = car.x + Math.cos(side) * 30;
  player.y = car.y + Math.sin(side) * 30;
  const resolved = collideBuildings(state.city, player.x, player.y, PLAYER.radius);
  player.x = resolved.x;
  player.y = resolved.y;
  player.vx = 0;
  player.vy = 0;
  car.kind = 'parked';
  car.speed = 0;
  player.carId = null;
  player.onFoot = true;
  fns.audio.click();
}
