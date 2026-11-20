// Cars: arcade driving physics for the player's car, simple road
// following AI for traffic, parked cars, collisions, and the exit.
import { CONFIG, CAR_COLORS } from "./config.js";
import {
  circleHitsBuilding,
  clampToWorld,
  nearestRoadCenter,
  onRoad,
} from "./world.js";
import { isDown, wasPressed, anyDown } from "./input.js";
import { rngPick, rngRange, rngInt, rngChance } from "./rng.js";
import { addMessage, addWanted } from "./police.js";
import { damageCar } from "./player.js";

let nextCarId = 1;

export function createCar(x, y, angle, opts) {
  const o = opts || {};
  return {
    id: nextCarId++,
    x,
    y,
    angle,
    speed: 0,
    color: o.color || "#e63946",
    kind: o.kind || "sedan",
    traffic: !!o.traffic,
    parked: !!o.parked,
    driver: !!o.driver,
    wrecked: false,
    hp: 100,
    ai: o.ai || null,
    targetSpeed: o.targetSpeed || CONFIG.trafficSpeed,
    skid: 0,
  };
}

// Spawn the city's traffic and parked cars from the seeded rng.
export function spawnCityCars(state) {
  const rng = state.rng;
  const world = state.world;
  for (let i = 0; i < CONFIG.trafficCount; i++) {
    const road = rngPick(rng, world.roads);
    const along = rngRange(rng, 200, world.size - 200);
    const vertical = rngChance(rng, 0.5);
    const dir = rngChance(rng, 0.5) ? 1 : -1;
    const lane = rngChance(rng, 0.5) ? 14 : -14;
    const x = vertical ? road + lane : along;
    const y = vertical ? along : road + lane;
    const angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI;
    state.cars.push(
      createCar(x, y, angle, {
        color: rngPick(rng, CAR_COLORS),
        kind: rngPick(rng, ["sedan", "sedan", "taxi", "van", "sport"]),
        traffic: true,
        driver: true,
        ai: { vertical, road, dir, speed: rngRange(rng, 110, 190) },
      }),
    );
  }
  for (let i = 0; i < CONFIG.parkedCount; i++) {
    const road = rngPick(rng, world.roads);
    const along = rngRange(rng, 200, world.size - 200);
    const vertical = rngChance(rng, 0.5);
    const side = rngChance(rng, 0.5) ? 1 : -1;
    const x = vertical ? road + side * 26 : along;
    const y = vertical ? along : road + side * 26;
    const angle = vertical ? (rngChance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2) : rngChance(rng, 0.5) ? 0 : Math.PI;
    state.cars.push(
      createCar(x, y, angle, {
        color: rngPick(rng, CAR_COLORS),
        kind: rngPick(rng, ["sedan", "sedan", "van", "sport"]),
        parked: true,
      }),
    );
  }
}

// The hero car for mission 2: a coral sports car parked in Vela Point.
export function spawnTargetCar(state, x, y) {
  const car = createCar(x, y, Math.PI / 2, {
    color: "#ff5d73",
    kind: "sport",
    parked: true,
  });
  car.target = true;
  state.cars.push(car);
  return car;
}

export function updateCars(state, dt) {
  const input = state.input;

  // Step out of the car with E.
  if (state.playerCar && wasPressed(input, "e")) {
    const car = state.playerCar;
    state.playerCar = null;
    state.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    state.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    state.player.angle = car.angle;
    addMessage(state, "Out of the car.");
  }

  if (state.playerCar) updatePlayerCar(state, dt);

  for (const car of state.cars) {
    if (car === state.playerCar || car.wrecked) continue;
    if (car.traffic && car.ai) updateTrafficCar(state, car, dt);
  }

  // Cheap pairwise separation so cars do not overlap. Cars are long
  // (52) and narrow (26), so overlap is tested in each car's own
  // frame: two cars passing in adjacent lanes (28 apart) must not
  // count as a collision.
  const cars = state.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      if (a.wrecked && b.wrecked) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const ca = Math.cos(a.angle);
      const sa = Math.sin(a.angle);
      const along = dx * ca + dy * sa;
      const side = -dx * sa + dy * ca;
      if (Math.abs(along) >= 44 || Math.abs(side) >= 24) continue;
      const pushSide = (24 - Math.abs(side)) / 2 * (side >= 0 ? 1 : -1);
      const pushAlong = (44 - Math.abs(along)) / 2 * 0.3 * (along >= 0 ? 1 : -1);
      if (!a.parked) {
        a.x -= -sa * pushSide + ca * pushAlong;
        a.y -= ca * pushSide + sa * pushAlong;
      }
      if (!b.parked) {
        b.x += -sa * pushSide + ca * pushAlong;
        b.y += ca * pushSide + sa * pushAlong;
      }
      // Hit and run: only when the player's car rear-ends a traffic
      // car from behind, not when passing in the next lane.
      if (a === state.playerCar || b === state.playerCar) {
        const other = a === state.playerCar ? b : a;
        const pc = state.playerCar;
        const pdx = other.x - pc.x;
        const pdy = other.y - pc.y;
        const pAhead = pdx * Math.cos(pc.angle) + pdy * Math.sin(pc.angle);
        const pSide = Math.abs(-pdx * Math.sin(pc.angle) + pdy * Math.cos(pc.angle));
        if (other.traffic && Math.abs(pc.speed) > 120 && pAhead > 0 && pSide < 24) {
          // One crash counts once: a per-car cooldown stops a single
          // overlap from spiking the wanted level frame after frame.
          if (!other.lastHit || state.time - other.lastHit > 1.5) {
            other.lastHit = state.time;
            damageCar(state, other, 25);
            addWanted(state, 1, "Hit and run — traffic called it in!");
          }
        }
      }
    }
  }
}

function updatePlayerCar(state, dt) {
  const input = state.input;
  const car = state.playerCar;
  const p = state.player;
  const forward = isDown(input, "w") || isDown(input, "ArrowUp") || !!state.shotDrive;
  const back = isDown(input, "s") || isDown(input, "ArrowDown");
  const left = isDown(input, "a") || isDown(input, "ArrowLeft");
  const right = isDown(input, "d") || isDown(input, "ArrowRight");
  const handbrake = isDown(input, " ");

  if (forward) car.speed += CONFIG.carAccel * dt;
  if (back) {
    if (car.speed > 20) car.speed -= CONFIG.carBrake * dt;
    else car.speed -= CONFIG.carReverseAccel * dt;
  }
  if (!forward && !back) {
    car.speed -= car.speed * CONFIG.carDrag * dt * 2;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  if (handbrake) {
    car.speed -= car.speed * 3.2 * dt;
    car.skid = 0.4;
  }
  car.speed = Math.max(-CONFIG.carMaxReverse, Math.min(CONFIG.carMaxSpeed, car.speed));

  // Screenshot cruise control: match the speed of any car ahead so
  // the demo drive never rear-ends traffic and draws police heat.
  if (state.shotDrive) {
    car.speed = Math.min(car.speed, 320);
    for (const other of state.cars) {
      if (other === car || other.wrecked) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 120 && side < 30) {
        car.speed = Math.min(car.speed, Math.max(120, other.speed || 150));
      }
    }
  }

  // Steering only bites while moving; faster means less turn.
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const moving = Math.abs(car.speed) > 12;
  if (moving && steer !== 0) {
    const dir = car.speed >= 0 ? 1 : -1;
    const grip = 1 - Math.min(0.55, Math.abs(car.speed) / 1400);
    car.angle += steer * CONFIG.carTurnRate * grip * dir * dt;
  }
  car.skid = Math.max(0, car.skid - dt);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Buildings stop the car; slide along them instead of sticking.
  if (!circleHitsBuilding(state.world, nx, car.y, 22)) car.x = nx;
  else car.speed *= 0.4;
  if (!circleHitsBuilding(state.world, car.x, ny, 22)) car.y = ny;
  else car.speed *= 0.4;
  const clamped = clampToWorld(state.world, car.x, car.y);
  car.x = clamped.x;
  car.y = clamped.y;

  // Running over a pedestrian is a crime. A fast car bearing down
  // startles people first: they dive for the nearest sidewalk. Only
  // a pedestrian caught dead-centre, off the sidewalk strips, gets
  // hit — so a cruise down a road does not mow down the crowd, but
  // a panicked pedestrian who runs into the road still can be hit.
  for (const ped of state.peds) {
    if (ped.down > 0) continue;
    const dist = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (dist >= 60 || Math.abs(car.speed) <= 60) continue;
    if (!ped.fleeing || ped.panic < 1) {
      ped.fleeing = true;
      ped.panic = 2;
      ped.fleeSpeed = 280;
      const cx = nearestRoadCenter(state.world, ped.x);
      const cy = nearestRoadCenter(state.world, ped.y);
      const ox = ped.x - cx;
      const oy = ped.y - cy;
      let dx = 0;
      let dy = 0;
      if (Math.abs(oy) < 32) dy = oy >= 0 ? 1 : -1;
      if (Math.abs(ox) < 32) dx = ox >= 0 ? 1 : -1;
      if (dx === 0 && dy === 0) {
        const away = Math.atan2(ped.y - car.y, ped.x - car.x);
        dx = Math.cos(away);
        dy = Math.sin(away);
      }
      ped.fleeX = ped.x + dx * 220;
      ped.fleeY = ped.y + dy * 220;
    }
    if (dist < 26) {
      const sideX = Math.abs(ped.x - nearestRoadCenter(state.world, ped.x));
      const sideY = Math.abs(ped.y - nearestRoadCenter(state.world, ped.y));
      const onSidewalk = (sideX >= 34 && sideX <= 50) || (sideY >= 34 && sideY <= 50);
      if (!onSidewalk) {
        ped.down = 3;
        ped.fleeing = false;
        state.effects.push({ x: ped.x, y: ped.y, life: 0.5, max: 0.5, kind: "hit" });
        addWanted(state, 1, "You ran someone over!");
        car.speed *= 0.7;
      }
    }
  }

  // The player rides with the car.
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = Math.abs(car.speed);
}

function updateTrafficCar(state, car, dt) {
  const ai = car.ai;
  // A car ahead too close: slow down instead of rear-ending it.
  let blocked = false;
  for (const other of state.cars) {
    if (other === car || other.wrecked) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 78 && side < 26) {
      blocked = true;
      break;
    }
  }
  const speed = blocked ? ai.speed * 0.25 : ai.speed;
  car.speed = speed;
  car.x += Math.cos(car.angle) * speed * dt;
  car.y += Math.sin(car.angle) * speed * dt;

  // At an intersection, sometimes turn onto the crossing road.
  const onCross = onRoad(state.world, car.x, car.y) &&
    Math.abs(car.x - nearestRoadCenter(state.world, car.x)) < 30 &&
    Math.abs(car.y - nearestRoadCenter(state.world, car.y)) < 30;
  if (onCross && rngChance(state.rng, dt * 0.5)) {
    const turnLeft = rngChance(state.rng, 0.5);
    car.angle += turnLeft ? Math.PI / 2 : -Math.PI / 2;
    car.ai.vertical = !car.ai.vertical;
    car.ai.road = car.ai.vertical ? car.x : car.y;
  }

  // Wrap around the far edge so traffic never runs out.
  const m = 60;
  if (car.x < m) car.x = state.world.size - m;
  if (car.x > state.world.size - m) car.x = m;
  if (car.y < m) car.y = state.world.size - m;
  if (car.y > state.world.size - m) car.y = m;

  // A traffic car that somehow ends up inside a building turns back.
  if (circleHitsBuilding(state.world, car.x, car.y, 20)) {
    car.angle += Math.PI;
    car.x += Math.cos(car.angle) * 30;
    car.y += Math.sin(car.angle) * 30;
  }
}

// How fast the player's car is going, for the HUD speedometer.
export function playerSpeed(state) {
  return state.playerCar ? Math.abs(state.playerCar.speed) : 0;
}
