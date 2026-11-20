// Pedestrians of Meridian Bay: they stroll the sidewalks, cross at
// corners, scatter when shots ring out, and sometimes drop a few
// dollars when startled. They keep the city feeling alive.
import { CONFIG, PED_COLORS } from "./config.js";
import { rngPick, rngRange, rngChance } from "./rng.js";
import { nearestRoadCenter, clampToWorld } from "./world.js";
import { addMessage } from "./police.js";

export function createPed(x, y, color) {
  return {
    x,
    y,
    color,
    angle: rngRange(Math.random, 0, Math.PI * 2),
    speed: CONFIG.pedWalkSpeed,
    targetX: x,
    targetY: y,
    fleeing: false,
    fleeX: x,
    fleeY: y,
    panic: 0,
    down: 0,
    bob: Math.random() * Math.PI * 2,
  };
}

export function spawnPeds(state) {
  const rng = state.rng;
  for (let i = 0; i < CONFIG.pedCount; i++) {
    const road = rngPick(rng, state.world.roads);
    const along = rngRange(rng, 120, state.world.size - 120);
    const vertical = rngChance(rng, 0.5);
    const side = rngChance(rng, 0.5) ? 1 : -1;
    const x = vertical ? road + side * 42 : along;
    const y = vertical ? along : road + side * 42;
    const ped = createPed(x, y, rngPick(rng, PED_COLORS));
    pickWalkTarget(state, ped);
    state.peds.push(ped);
  }
}

// A driver who just lost their car becomes a fleeing pedestrian.
export function spawnFleeingPed(state, x, y) {
  const ped = createPed(x, y, rngPick(state.rng, PED_COLORS));
  ped.fleeing = true;
  ped.panic = 4;
  const away = Math.atan2(y - state.player.y, x - state.player.x);
  ped.fleeX = x + Math.cos(away) * 300;
  ped.fleeY = y + Math.sin(away) * 300;
  state.peds.push(ped);
  return ped;
}

export function updatePeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      continue;
    }
    ped.bob += dt * 8;
    ped.panic = Math.max(0, ped.panic - dt);

    // A nearby gunshot or a cop siren sends them running.
    if (!ped.fleeing) {
      for (const effect of state.effects) {
        if ((effect.kind === "muzzle" || effect.kind === "boom") &&
          Math.hypot(effect.x - ped.x, effect.y - ped.y) < 260) {
          ped.fleeing = true;
          ped.panic = 3;
          maybeDropCash(state, ped);
          const away = Math.atan2(ped.y - effect.y, ped.x - effect.x);
          ped.fleeX = ped.x + Math.cos(away) * 260;
          ped.fleeY = ped.y + Math.sin(away) * 260;
          break;
        }
      }
    }

    let tx = ped.targetX;
    let ty = ped.targetY;
    let speed = ped.speed;
    if (ped.fleeing) {
      tx = ped.fleeX;
      ty = ped.fleeY;
      // A pedestrian startled by a car sprints; one startled by a
      // distant gunshot just hurries.
      speed = ped.fleeSpeed || CONFIG.pedFleeSpeed;
    }
    const dx = tx - ped.x;
    const dy = ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      if (ped.fleeing) {
        ped.fleeing = false;
        if (ped.panic <= 0) pickWalkTarget(state, ped);
      } else {
        pickWalkTarget(state, ped);
      }
    } else {
      // Pedestrians wait when a fast car is close: nobody strolls
      // into traffic, so a car cruising a road does not mow down
      // people crossing at the corners. A fleeing pedestrian is the
      // exception — they must keep running for the sidewalk.
      let carNear = false;
      if (!ped.fleeing) {
        for (const car of state.cars) {
          if (car.wrecked || Math.abs(car.speed) < 80) continue;
          if (Math.hypot(car.x - ped.x, car.y - ped.y) < 110) {
            carNear = true;
            break;
          }
        }
      }
      if (!carNear) {
        ped.angle = Math.atan2(dy, dx);
        ped.x += (dx / d) * speed * dt;
        ped.y += (dy / d) * speed * dt;
        const clamped = clampToWorld(state.world, ped.x, ped.y);
        ped.x = clamped.x;
        ped.y = clamped.y;
      }
    }
  }

  // Keep the streets populated: replace peds who wandered too far.
  let far = 0;
  for (const ped of state.peds) {
    if (Math.hypot(ped.x - state.player.x, ped.y - state.player.y) > 1400) far++;
  }
  if (far > 6) {
    for (let i = state.peds.length - 1; i >= 0 && far > 0; i--) {
      const ped = state.peds[i];
      if (Math.hypot(ped.x - state.player.x, ped.y - state.player.y) > 1400) {
        const road = rngPick(state.rng, state.world.roads);
        const along = state.player.y + rngRange(state.rng, -500, 500);
        ped.x = road + 42;
        ped.y = Math.max(120, Math.min(state.world.size - 120, along));
        pickWalkTarget(state, ped);
        far--;
      }
    }
  }
}

// Pick a new stroll target: a sidewalk point a block or two away
// along the SAME road the pedestrian is already on. Walking straight
// along a sidewalk keeps pedestrians off the asphalt, so a car
// cruising down a road does not plough through them.
function pickWalkTarget(state, ped) {
  const roadX = nearestRoadCenter(state.world, ped.x);
  const roadY = nearestRoadCenter(state.world, ped.y);
  const side = rngChance(state.rng, 0.5) ? 42 : -42;
  const step = rngRange(state.rng, 120, 420) * (rngChance(state.rng, 0.5) ? 1 : -1);
  // Near a vertical road's sidewalk: walk along it.
  if (Math.abs(ped.x - roadX) <= 60) {
    ped.targetX = roadX + side;
    ped.targetY = Math.max(80, Math.min(state.world.size - 80, ped.y + step));
  } else {
    ped.targetX = Math.max(80, Math.min(state.world.size - 80, ped.x + step));
    ped.targetY = roadY + side;
  }
}

// A startled pedestrian sometimes drops a little cash.
export function maybeDropCash(state, ped) {
  if (rngChance(state.rng, 0.25)) {
    const amount = rngPick(state.rng, [5, 10, 20]);
    state.player.cash += amount;
    addMessage(state, "A fleeing pedestrian dropped $" + amount + "!");
  }
}
