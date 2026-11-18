// Pedestrians: sidewalk walkers who give the city life. They stroll along the
// kerb, turn at intersections, and scatter when a car comes at them. Running
// one over is a crime — the wanted system hears about it.

import { CITY, PED, ROAD, WATER_Y } from './config.js';
import { collideBuildings, randomRoadPoint } from './city.js';
import { pick } from './random.js';

const SHIRTS = ['#c9d4e8', '#ffd76a', '#ff9ecf', '#7dffce', '#e8e8f0', '#ffb347'];

export function createPeds(city, random, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const point = randomRoadPoint(city, random);
    const axis = point.axis;
    const dir = random() < 0.5 ? 1 : -1;
    const speed = PED.speedMin + random() * (PED.speedMax - PED.speedMin);
    // Walk on the sidewalk: just outside the road's edge.
    let x = point.x;
    let y = point.y;
    if (axis === 'v') {
      x = point.x + (random() < 0.5 ? ROAD.half + 14 : -ROAD.half - 14);
      y = ROAD.first + random() * (WATER_Y - ROAD.first);
    } else {
      y = point.y + (random() < 0.5 ? ROAD.half + 14 : -ROAD.half - 14);
      x = ROAD.first + random() * (CITY.width - ROAD.first);
    }
    peds.push({
      x,
      y,
      axis,
      dir,
      speed,
      shirt: pick(random, SHIRTS),
      phase: random() * Math.PI * 2,
      down: false,
    });
  }
  return peds;
}

/**
 * One step for every pedestrian. `threats` is the list of fast cars to flee
 * from (the player's car and police); a fleeing walker runs perpendicular to
 * the road. Walkers that wander into a building are pushed back out.
 */
export function stepPeds(peds, city, threats, dt) {
  for (const ped of peds) {
    if (ped.down) continue;
    let fleeX = 0;
    let fleeY = 0;
    for (const car of threats) {
      const dx = ped.x - car.x;
      const dy = ped.y - car.y;
      const d = Math.hypot(dx, dy);
      if (d < 130 && Math.abs(car.speed) > 120) {
        const w = (130 - d) / 130;
        fleeX += (dx / (d || 1)) * w;
        fleeY += (dy / (d || 1)) * w;
      }
    }
    let mx = 0;
    let my = 0;
    if (fleeX !== 0 || fleeY !== 0) {
      const len = Math.hypot(fleeX, fleeY) || 1;
      mx = (fleeX / len) * 1.6;
      my = (fleeY / len) * 1.6;
    } else if (ped.axis === 'v') {
      my = ped.dir;
    } else {
      mx = ped.dir;
    }
    ped.x += mx * ped.speed * dt;
    ped.y += my * ped.speed * dt;
    ped.phase += dt * 6;
    // Turn around at the city edge or the water.
    if (ped.x < 60) {
      ped.x = 60;
      ped.dir = 1;
    } else if (ped.x > CITY.width - 60) {
      ped.x = CITY.width - 60;
      ped.dir = -1;
    }
    if (ped.y < 60) {
      ped.y = 60;
      ped.dir = 1;
    } else if (ped.y > WATER_Y - 40) {
      ped.y = WATER_Y - 40;
      ped.dir = -1;
    }
    const resolved = collideBuildings(city, ped.x, ped.y, PED.radius);
    if (resolved.x !== ped.x || resolved.y !== ped.y) {
      // Walked into a building: turn around and step back out.
      ped.dir *= -1;
      ped.x = resolved.x;
      ped.y = resolved.y;
    }
  }
}
