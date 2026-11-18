// Cars: traffic that follows the road grid, police that chase the player, and
// the parked cars waiting to be driven. Traffic keeps to its lane (right-hand
// traffic), turns at intersections sometimes, and wraps around the city edge;
// police steer straight at the player and ram. Car physics lives here too:
// accelerate, brake, reverse, steer — shared by the player's car and the AI.

import { CAR, CITY, ROAD, WATER_Y } from './config.js';
import { collideBuildings, randomRoadPoint } from './city.js';
import { pick } from './random.js';

let nextCarId = 1;

export function makeCar(kind, x, y, angle, speed, color) {
  const car = {
    id: nextCarId,
    kind, // 'traffic' | 'parked' | 'police' | 'player'
    x,
    y,
    angle,
    speed,
    color,
    axis: 'v',
    dir: 1,
    turnCooldown: 0,
    sirenPhase: Math.random() * Math.PI * 2,
    skid: 0,
  };
  nextCarId += 1;
  return car;
}

export function createTraffic(city, random, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const point = randomRoadPoint(city, random);
    const dir = random() < 0.5 ? 1 : -1;
    const speed = CAR.trafficSpeedMin + random() * (CAR.trafficSpeedMax - CAR.trafficSpeedMin);
    let x = point.x;
    let y = point.y;
    let angle = 0;
    if (point.axis === 'v') {
      // Right-hand traffic: heading down drives on the right side of the road.
      x = point.x + (dir > 0 ? 24 : -24);
      angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      y = point.y + (dir > 0 ? 24 : -24);
      angle = dir > 0 ? 0 : Math.PI;
    }
    const car = makeCar('traffic', x, y, angle, speed, pick(random, city.carColors));
    car.axis = point.axis;
    car.dir = dir;
    cars.push(car);
  }
  return cars;
}

export function createParked(city) {
  return city.parkedSpots.map((spot) => {
    const car = makeCar('parked', spot.x, spot.y, spot.angle, 0, spot.color);
    return car;
  });
}

/** One traffic car: cruise along its road, sometimes turn at an intersection. */
export function stepTrafficCar(car, city, random, dt) {
  if (car.turnCooldown > 0) car.turnCooldown -= dt;
  const onVertical = car.axis === 'v';
  const pos = onVertical ? car.y : car.x;
  // Near an intersection centre, a small chance to turn onto the crossing road.
  if (car.turnCooldown <= 0) {
    const lines = onVertical ? city.horizontal : city.vertical;
    for (const line of lines) {
      if (Math.abs(pos - line) < 26 && random() < 0.012) {
        const newDir = random() < 0.5 ? 1 : -1;
        car.axis = onVertical ? 'h' : 'v';
        car.dir = newDir;
        car.turnCooldown = 2.5;
        if (car.axis === 'v') {
          car.x = line + (newDir > 0 ? 24 : -24);
          car.angle = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          car.y = line + (newDir > 0 ? 24 : -24);
          car.angle = newDir > 0 ? 0 : Math.PI;
        }
        break;
      }
    }
  }
  if (car.axis === 'v') {
    car.y += car.dir * car.speed * dt;
    if (car.y < ROAD.first - 60) car.y = WATER_Y - 80;
    if (car.y > WATER_Y - 60) car.y = ROAD.first - 40;
  } else {
    car.x += car.dir * car.speed * dt;
    if (car.x < ROAD.first - 60) car.x = CITY.width - 80;
    if (car.x > CITY.width - 60) car.x = ROAD.first - 40;
  }
}

/** A police car appears on the nearest road, some distance from the player. */
export function spawnPolice(city, random, px, py) {
  const point = randomRoadPoint(city, random);
  // Keep the spawn off-screen-ish: at least 420 px from the player when possible.
  let tries = 0;
  let spawn = point;
  while (tries < 6 && Math.hypot(spawn.x - px, spawn.y - py) < 420) {
    spawn = randomRoadPoint(city, random);
    tries += 1;
  }
  const car = makeCar('police', spawn.x, spawn.y, 0, 0, '#2b6cff');
  car.axis = spawn.axis;
  return car;
}

/** One police car: steer at the player, accelerate, ram. Returns true on hard contact. */
export function stepPoliceCar(car, px, py, city, dt) {
  const dx = px - car.x;
  const dy = py - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-3.4 * dt, Math.min(3.4 * dt, diff));
  car.speed = Math.min(CAR.policeSpeed, car.speed + CAR.policeAccel * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const resolved = collideBuildings(city, car.x, car.y, CAR.radius);
  if (resolved.x !== car.x || resolved.y !== car.y) {
    // Bounced off a building: slow down and turn away a little.
    car.speed *= 0.45;
    car.angle += 0.7;
    car.x = resolved.x;
    car.y = resolved.y;
  }
  car.x = Math.max(40, Math.min(CITY.width - 40, car.x));
  car.y = Math.max(40, Math.min(WATER_Y - 30, car.y));
  return dist < CAR.radius + 16;
}

/** Drive a car with throttle (-1..1) and steering (-1..1); returns skid amount. */
export function driveCar(car, throttle, steer, dt) {
  // Drag always pulls the speed toward zero, so a half throttle cruises
  // instead of running away to top speed.
  car.speed -= car.speed * CAR.drag * dt;
  if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
  if (throttle > 0) car.speed += CAR.accel * throttle * dt;
  else if (throttle < 0) car.speed += CAR.brake * throttle * dt;
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  const steerAmount = CAR.steer * steer * dt * Math.min(1, Math.abs(car.speed) / 140 + 0.25);
  car.angle += steerAmount * Math.sign(car.speed || 1);
  const skid = Math.abs(steer) > 0.7 && Math.abs(car.speed) > 300 ? 1 : 0;
  return skid;
}

/** Move a car by its speed and angle, keeping it out of buildings and the water. */
export function moveCar(car, city, dt) {
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const resolved = collideBuildings(city, car.x, car.y, CAR.radius);
  if (resolved.x !== car.x || resolved.y !== car.y) {
    // Scraped a building: lose some speed, but keep sliding along the wall.
    car.speed *= 0.65;
    car.x = resolved.x;
    car.y = resolved.y;
    return true; // crashed into a building
  }
  car.x = Math.max(30, Math.min(CITY.width - 30, car.x));
  car.y = Math.max(30, Math.min(WATER_Y - 24, car.y));
  return false;
}

/** Push two overlapping cars apart so traffic does not pile through itself.
 * The player's car and parked cars are immovable: traffic yields to them,
 * so a passing car can never shove the player into a building face. */
export function separateCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = CAR.radius * 2 - 4;
  if (d === 0 || d >= min) return;
  const push = (min - d) / 2;
  const nx = dx / d;
  const ny = dy / d;
  const aFixed = a.kind === 'player' || a.kind === 'parked';
  const bFixed = b.kind === 'player' || b.kind === 'parked';
  if (!aFixed) {
    a.x -= nx * push * (bFixed ? 2 : 1);
    a.y -= ny * push * (bFixed ? 2 : 1);
  }
  if (!bFixed) {
    b.x += nx * push * (aFixed ? 2 : 1);
    b.y += ny * push * (aFixed ? 2 : 1);
  }
}
