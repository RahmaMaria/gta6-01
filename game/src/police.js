// Wanted stars and the Meridian Bay police. Crimes raise heat, cops
// spawn on the roads near the player and chase, ram, and — on foot —
// try to bust Mara. Lay low out of sight and the heat cools off.
import { CONFIG } from "./config.js";
import { randomRoadPoint, clampToWorld, circleHitsBuilding } from "./world.js";
import { rngRange } from "./rng.js";
import { playBlip } from "./audio.js";

// Push a short message into the HUD feed.
export function addMessage(state, text) {
  state.messages.push({ text, t: 4 });
  if (state.messages.length > 4) state.messages.shift();
}

// Raise the wanted level, capped at 5, with a HUD message.
export function addWanted(state, stars, reason) {
  if (state.wanted >= CONFIG.maxWanted) return;
  state.wanted = Math.min(CONFIG.maxWanted, state.wanted + stars);
  state.unseenTimer = 0;
  if (reason) addMessage(state, reason);
  if (state.wanted >= 3) playBlip(state.audio, 220);
}

export function createCop(x, y, angle) {
  return {
    id: Math.floor(Math.random() * 1e9),
    x,
    y,
    angle,
    speed: 0,
    color: "#1d3557",
    kind: "cop",
    hp: 120,
    wrecked: false,
    traffic: false,
    parked: false,
    driver: true,
    bustedTimer: 0,
  };
}

export function updatePolice(state, dt) {
  // How many cops the heat calls for.
  const wanted = state.wanted;
  const desired = wanted === 0 ? 0 : Math.min(1 + wanted, CONFIG.maxCops);
  while (state.cops.length < desired) {
    spawnCop(state);
  }
  while (state.cops.length > desired) {
    state.cops.pop();
  }

  // Heat cools when no cop can see the player for a while.
  let nearest = Infinity;
  for (const cop of state.cops) {
    nearest = Math.min(nearest, Math.hypot(cop.x - state.player.x, cop.y - state.player.y));
  }
  if (wanted > 0 && (state.cops.length === 0 || nearest > 520)) {
    state.unseenTimer += dt;
    if (state.unseenTimer > CONFIG.wantedDecaySeconds) {
      state.wanted--;
      state.unseenTimer = 0;
      addMessage(state, "Heat cooling off — " + state.wanted + " star" + (state.wanted === 1 ? "" : "s") + " left.");
    }
  } else {
    state.unseenTimer = 0;
  }

  // Each cop chases the player and rams.
  for (const cop of state.cops) {
    if (cop.wrecked) continue;
    updateCop(state, cop, dt);
  }
}

function spawnCop(state) {
  const p = randomRoadPoint(state.rng, state.world, 300);
  // Spawn on a road a good distance from the player, not on top of them.
  let tries = 0;
  let point = p;
  while (tries < 8 && Math.hypot(point.x - state.player.x, point.y - state.player.y) < CONFIG.copSpawnDistance) {
    point = randomRoadPoint(state.rng, state.world, 300);
    tries++;
  }
  const angle = Math.atan2(state.player.y - point.y, state.player.x - point.x);
  state.cops.push(createCop(point.x, point.y, angle));
}

function updateCop(state, cop, dt) {
  const p = state.player;
  const dx = p.x - cop.x;
  const dy = p.y - cop.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wantAngle = Math.atan2(dy, dx);

  // Steer toward the player, limited turn rate, then accelerate.
  let diff = wantAngle - cop.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = Math.max(-CONFIG.policeTurnRate * dt, Math.min(CONFIG.policeTurnRate * dt, diff));
  cop.angle += turn;
  const topSpeed = CONFIG.policeTopSpeed * (0.85 + state.wanted * 0.05);
  cop.speed = Math.min(topSpeed, cop.speed + 620 * dt);
  // Cops cut corners but never drive through a building: if the next
  // step would hit one, swing around it and slow down.
  const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
  const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
  if (circleHitsBuilding(state.world, nx, ny, 22)) {
    cop.angle += 0.9;
    cop.speed *= 0.6;
  } else {
    cop.x = nx;
    cop.y = ny;
  }
  const clamped = clampToWorld(state.world, cop.x, cop.y);
  cop.x = clamped.x;
  cop.y = clamped.y;

  // Ram: hitting the player's car hurts the player; touching Mara
  // on foot starts a bust.
  if (dist < 46) {
    if (state.playerCar) {
      p.hp -= CONFIG.policeRamDamage * dt * 3;
      state.playerCar.speed *= 0.92;
      state.effects.push({ x: cop.x, y: cop.y, life: 0.2, max: 0.2, kind: "spark" });
      if (p.hp <= 0) state.deathReason = "rammed";
    } else {
      cop.bustedTimer += dt;
      if (cop.bustedTimer > 1.2) {
        bustPlayer(state);
      }
    }
  } else {
    cop.bustedTimer = Math.max(0, cop.bustedTimer - dt);
  }

  // Cops also shove traffic cars out of the way.
  for (const car of state.cars) {
    if (car === state.playerCar || car.wrecked) continue;
    const d = Math.hypot(car.x - cop.x, car.y - cop.y);
    if (d < 44 && d > 0.01) {
      const push = (44 - d) / 2;
      car.x += ((car.x - cop.x) / d) * push;
      car.y += ((car.y - cop.y) / d) * push;
    }
  }
}

function bustPlayer(state) {
  state.wanted = 0;
  state.cops = [];
  const fine = Math.floor(state.player.cash * 0.2);
  state.player.cash -= fine;
  state.player.hp = CONFIG.playerHealth;
  state.playerCar = null;
  // Back to the precinct steps in Coral Row, the spawn point.
  state.player.x = state.spawn.x;
  state.player.y = state.spawn.y;
  addMessage(state, "BUSTED! The precinct took $" + fine + " and let you walk.");
  state.stats.busted++;
}
