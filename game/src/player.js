// Mara Voss on foot: walking, sprinting, punching, shooting, and
// getting in and out of cars. All movement collides with buildings
// and stays inside the map.
import { CONFIG } from "./config.js";
import { circleHitsBuilding, clampToWorld } from "./world.js";
import { isDown, wasPressed, anyDown, isClicked } from "./input.js";
import { playShot, playBlip } from "./audio.js";
import { addMessage, addWanted } from "./police.js";
import { spawnFleeingPed, maybeDropCash } from "./pedestrians.js";

export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: -Math.PI / 2,
    hp: CONFIG.playerHealth,
    cash: CONFIG.startCash,
    speed: 0,
    shootCd: 0,
    punchCd: 0,
    heatTimer: 0,
    moving: false,
  };
}

// Nearest car to the player within maxDist, or null.
export function nearestCar(state, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    if (car.wrecked) continue;
    const dx = car.x - state.player.x;
    const dy = car.y - state.player.y;
    const d = Math.hypot(dx, dy);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function updatePlayer(state, dt) {
  const input = state.input;
  const p = state.player;
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.heatTimer = Math.max(0, p.heatTimer - dt);

  // Getting into a car.
  if (wasPressed(input, "e") && !state.playerCar) {
    const car = nearestCar(state, 78);
    if (car) stealOrEnter(state, car);
    else addMessage(state, "No car close enough — walk up to one and press E.");
  }

  // Getting out of a car is handled by vehicles.js; on foot here.
  if (state.playerCar) return;

  // Movement: WASD or arrows, Shift to sprint.
  let mx = 0;
  let my = 0;
  if (isDown(input, "w") || isDown(input, "ArrowUp")) my -= 1;
  if (isDown(input, "s") || isDown(input, "ArrowDown")) my += 1;
  if (isDown(input, "a") || isDown(input, "ArrowLeft")) mx -= 1;
  if (isDown(input, "d") || isDown(input, "ArrowRight")) mx += 1;
  const sprint = isDown(input, "Shift");
  const speed = sprint ? CONFIG.sprintSpeed : CONFIG.walkSpeed;
  p.moving = mx !== 0 || my !== 0;
  if (p.moving) {
    const len = Math.hypot(mx, my);
    const nx = p.x + (mx / len) * speed * dt;
    const ny = p.y + (my / len) * speed * dt;
    p.angle = Math.atan2(my, mx);
    p.speed = speed;
    // Move axis by axis so walls slide instead of sticking.
    if (!circleHitsBuilding(state.world, nx, p.y, CONFIG.playerRadius)) p.x = nx;
    if (!circleHitsBuilding(state.world, p.x, ny, CONFIG.playerRadius)) p.y = ny;
    const clamped = clampToWorld(state.world, p.x, p.y);
    p.x = clamped.x;
    p.y = clamped.y;
  } else {
    p.speed = 0;
  }

  // Aim with the mouse when it has moved; otherwise face movement.
  if (input.mouseDown || input.mousePressed) {
    aimAtMouse(state);
  }

  // Punch with F or left click up close.
  if ((wasPressed(input, "f") || isClicked(input)) && p.punchCd <= 0) {
    punch(state);
  }
  // Shoot with Space (or Q) — a loud crime in the open.
  if ((wasPressed(input, " ") || wasPressed(input, "q")) && p.shootCd <= 0) {
    shoot(state);
  }
}

function aimAtMouse(state) {
  const cam = state.camera;
  const wx = cam.x + (state.input.mouseX - state.canvas.width / 2) / cam.zoom;
  const wy = cam.y + (state.input.mouseY - state.canvas.height / 2) / cam.zoom;
  state.player.angle = Math.atan2(wy - state.player.y, wx - state.player.x);
}

function stealOrEnter(state, car) {
  const p = state.player;
  if (car.traffic && car.driver) {
    // The driver bails and runs; taking a car with a driver is theft.
    spawnFleeingPed(state, car.x, car.y);
    car.driver = false;
    car.traffic = false;
    addWanted(state, CONFIG.carStealHeat, "Car stolen — the driver called it in!");
    state.stats.carsStolen++;
    addMessage(state, "You stole a " + car.kind + "! Lose the cops.");
  } else if (car.parked) {
    car.parked = false;
    car.traffic = false;
    addMessage(state, "Parked " + car.kind + " — yours now. No alarm, no heat.");
  }
  state.playerCar = car;
  car.speed = 0;
  p.x = car.x;
  p.y = car.y;
  playBlip(state.audio, 520);
}

function punch(state) {
  const p = state.player;
  p.punchCd = 0.35;
  let hit = null;
  let bestD = CONFIG.punchRange;
  for (const ped of state.peds) {
    if (ped.down > 0) continue;
    const dx = ped.x - p.x;
    const dy = ped.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > bestD) continue;
    const ang = Math.atan2(dy, dx);
    let diff = Math.abs(ang - p.angle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < CONFIG.punchArc) {
      bestD = d;
      hit = ped;
    }
  }
  if (hit) {
    hit.fleeX = hit.x + (hit.x - p.x) * 4;
    hit.fleeY = hit.y + (hit.y - p.y) * 4;
    hit.fleeing = true;
    hit.panic = 3;
    maybeDropCash(state, hit);
    state.effects.push({ x: hit.x, y: hit.y, life: 0.25, max: 0.25, kind: "hit" });
    addMessage(state, "You shoved a pedestrian — they ran for it.");
    if (nearbyCop(state, 500)) addWanted(state, 1, "Assault witnessed by police!");
  } else {
    state.effects.push({
      x: p.x + Math.cos(p.angle) * 30,
      y: p.y + Math.sin(p.angle) * 30,
      life: 0.15,
      max: 0.15,
      kind: "swing",
    });
  }
}

function shoot(state) {
  const p = state.player;
  p.shootCd = CONFIG.shotCooldown;
  state.stats.shotsFired++;
  playShot(state.audio);
  const range = CONFIG.shotRange;
  const dx = Math.cos(p.angle);
  const dy = Math.sin(p.angle);
  state.effects.push({
    x: p.x + dx * 24,
    y: p.y + dy * 24,
    life: 0.08,
    max: 0.08,
    kind: "muzzle",
    angle: p.angle,
  });
  // Find the closest thing along the shot line.
  let bestD = range;
  let bestCar = null;
  let bestPed = null;
  let bestCop = null;
  for (const car of state.cars) {
    if (car.wrecked) continue;
    const d = rayHit(p.x, p.y, dx, dy, car.x, car.y, 30);
    if (d !== null && d < bestD) {
      bestD = d;
      bestCar = car;
      bestPed = null;
      bestCop = null;
    }
  }
  for (const ped of state.peds) {
    if (ped.down > 0) continue;
    const d = rayHit(p.x, p.y, dx, dy, ped.x, ped.y, 16);
    if (d !== null && d < bestD) {
      bestD = d;
      bestPed = ped;
      bestCar = null;
      bestCop = null;
    }
  }
  for (const cop of state.cops) {
    const d = rayHit(p.x, p.y, dx, dy, cop.x, cop.y, 30);
    if (d !== null && d < bestD) {
      bestD = d;
      bestCop = cop;
      bestCar = null;
      bestPed = null;
    }
  }
  const hx = p.x + dx * bestD;
  const hy = p.y + dy * bestD;
  state.effects.push({ x: hx, y: hy, life: 0.2, max: 0.2, kind: "spark" });
  if (bestCar) damageCar(state, bestCar, CONFIG.shotDamage);
  if (bestPed) {
    bestPed.down = 2.5;
    bestPed.fleeing = false;
    addMessage(state, "Pedestrian down! Someone will call this in.");
  }
  if (bestCop) damageCar(state, bestCop, CONFIG.shotDamage);
  // A gunshot in the open always draws heat, throttled to once per 2 s.
  if (p.heatTimer <= 0) {
    p.heatTimer = 2;
    addWanted(state, CONFIG.shootHeat, "Shots fired — police are coming!");
  }
}

function rayHit(ox, oy, dx, dy, cx, cy, radius) {
  const lx = cx - ox;
  const ly = cy - oy;
  const along = lx * dx + ly * dy;
  if (along < 0) return null;
  const px = ox + dx * along;
  const py = oy + dy * along;
  const dist = Math.hypot(cx - px, cy - py);
  if (dist > radius) return null;
  return along;
}

export function damageCar(state, car, amount) {
  car.hp = (car.hp || 100) - amount;
  state.effects.push({ x: car.x, y: car.y, life: 0.4, max: 0.4, kind: "smoke" });
  if (car.hp <= 0 && !car.wrecked) {
    car.wrecked = true;
    car.speed = 0;
    car.traffic = false;
    state.effects.push({ x: car.x, y: car.y, life: 0.9, max: 0.9, kind: "boom" });
    addMessage(state, "A car blew out — the whole bay heard that.");
    if (car === state.playerCar) {
      state.playerCar = null;
      state.player.hp -= 25;
    }
    addWanted(state, 1, "Explosion reported!");
  }
}

export function nearbyCop(state, dist) {
  for (const cop of state.cops) {
    if (Math.hypot(cop.x - state.player.x, cop.y - state.player.y) < dist) return true;
  }
  return false;
}
