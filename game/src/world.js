// City generation for Meridian Bay. A road grid with named districts,
// buildings packed into the blocks between roads, palms and lamps on
// the sidewalks, and a waterline along the south and east edges where
// the bay meets the city. Everything is seeded, so seed 7 always
// builds the same map.
import { CONFIG, DISTRICTS, STREET_NAMES } from "./config.js";
import { rngRange, rngInt, rngPick, rngChance } from "./rng.js";

export function buildWorld(rng) {
  const pitch = CONFIG.roadPitch;
  const roadHalf = CONFIG.roadWidth / 2;
  const count = CONFIG.roadCount;
  const size = CONFIG.worldSize;

  // Road centre lines, one per index in each direction.
  const roads = [];
  for (let i = 0; i < count; i++) {
    roads.push(i * pitch + pitch / 2);
  }

  // Districts: a 3x3 naming grid over the city.
  const districtGrid = [];
  for (let row = 0; row < 3; row++) {
    districtGrid[row] = [];
    for (let col = 0; col < 3; col++) {
      districtGrid[row][col] = DISTRICTS[row * 3 + col];
    }
  }

  // Buildings: up to four per block, with a gap for a courtyard or
  // parking lot. Each building is an axis-aligned box with a height
  // (drawn as a fake shadow offset) and a neon sign colour.
  const buildings = [];
  const neon = ["#ff4d8d", "#37e6ff", "#ffb347", "#9dff57", "#c77dff"];
  for (let bx = 0; bx < count - 1; bx++) {
    for (let by = 0; by < count - 1; by++) {
      const x0 = roads[bx] + roadHalf + 8;
      const y0 = roads[by] + roadHalf + 8;
      const x1 = roads[bx + 1] - roadHalf - 8;
      const y1 = roads[by + 1] - roadHalf - 8;
      const bw = x1 - x0;
      const bh = y1 - y0;
      const kind = rngInt(rng, 0, 2);
      if (kind === 0) {
        // One big block-filling building.
        buildings.push(makeBuilding(rng, x0, y0, bw, bh, neon));
      } else if (kind === 1) {
        // Two side-by-side buildings.
        const split = rngRange(rng, 0.4, 0.6);
        buildings.push(makeBuilding(rng, x0, y0, bw * split - 6, bh, neon));
        buildings.push(makeBuilding(rng, x0 + bw * split + 6, y0, bw * (1 - split) - 6, bh, neon));
      } else {
        // Four small buildings around a courtyard.
        const hw = bw / 2 - 6;
        const hh = bh / 2 - 6;
        buildings.push(makeBuilding(rng, x0, y0, hw, hh, neon));
        buildings.push(makeBuilding(rng, x0 + hw + 12, y0, hw, hh, neon));
        buildings.push(makeBuilding(rng, x0, y0 + hh + 12, hw, hh, neon));
        buildings.push(makeBuilding(rng, x0 + hw + 12, y0 + hh + 12, hw, hh, neon));
      }
    }
  }

  // Props: palms along sidewalks and lamps at intersections.
  const trees = [];
  const lamps = [];
  for (let i = 0; i < count; i++) {
    for (let j = 0; j < count; j++) {
      lamps.push({ x: roads[i] + roadHalf + 6, y: roads[j] - roadHalf - 6 });
      if (rngChance(rng, 0.6)) {
        trees.push({
          x: roads[i] - roadHalf - 10 + rngRange(rng, -4, 4),
          y: roads[j] + rngRange(rng, -100, 100),
          size: rngRange(rng, 9, 15),
        });
      }
      if (rngChance(rng, 0.6)) {
        trees.push({
          x: roads[i] + rngRange(rng, -100, 100),
          y: roads[j] - roadHalf - 10 + rngRange(rng, -4, 4),
          size: rngRange(rng, 9, 15),
        });
      }
    }
  }

  // The bay: water hugs the south and east edges of the map.
  const water = { south: size - 96, east: size - 96 };

  return {
    size,
    pitch,
    roadHalf,
    roads,
    buildings,
    trees,
    lamps,
    water,
    districtGrid,
    streetNames: STREET_NAMES,
  };
}

function makeBuilding(rng, x, y, w, h, neon) {
  const heights = [0, 6, 12, 20, 30];
  return {
    x,
    y,
    w,
    h,
    height: rngPick(rng, heights),
    color: pickRoof(rng),
    neon: rngChance(rng, 0.45) ? rngPick(rng, neon) : null,
    windows: rngInt(rng, 2, 6),
  };
}

function pickRoof(rng) {
  const roofs = ["#4a5468", "#55617a", "#3f4a5e", "#5d6b84", "#46536b", "#6b5d7a"];
  return rngPick(rng, roofs);
}

// True when the point is on a road (asphalt), either direction.
export function onRoad(world, x, y) {
  return nearestRoadDistance(world, x) <= world.roadHalf ||
    nearestRoadDistance(world, y) <= world.roadHalf;
}

// Distance from a coordinate to the nearest vertical road centre.
export function nearestRoadDistance(world, v) {
  let best = Infinity;
  for (const r of world.roads) {
    const d = Math.abs(v - r);
    if (d < best) best = d;
  }
  return best;
}

// Nearest road centre coordinate to v.
export function nearestRoadCenter(world, v) {
  let best = world.roads[0];
  let bestD = Infinity;
  for (const r of world.roads) {
    const d = Math.abs(v - r);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

// Circle vs building collision. Returns the building hit, or null.
export function circleHitsBuilding(world, x, y, radius) {
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < radius * radius) return b;
  }
  return null;
}

// District name for a world position.
export function districtAt(world, x, y) {
  const col = Math.min(2, Math.max(0, Math.floor((x / world.size) * 3)));
  const row = Math.min(2, Math.max(0, Math.floor((y / world.size) * 3)));
  return world.districtGrid[row][col];
}

// A random point on a road, for spawning cars and pedestrians.
export function randomRoadPoint(rng, world, margin) {
  const road = rngPick(rng, world.roads);
  const along = rngRange(rng, margin, world.size - margin);
  if (rngChance(rng, 0.5)) return { x: road, y: along };
  return { x: along, y: road };
}

// Clamp a position inside the playable map. The south and east edges
// are water, so the clamp stops at the beach (world size minus the
// 96-unit bay strip) instead of letting anyone walk on the sea.
export function clampToWorld(world, x, y) {
  const m = 24;
  const edge = world.size - 104;
  return {
    x: Math.max(m, Math.min(edge, x)),
    y: Math.max(m, Math.min(edge, y)),
  };
}
