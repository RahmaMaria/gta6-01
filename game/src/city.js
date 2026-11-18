// Meridian Bay: the city itself. A road grid every 320 px, blocks between the
// roads holding buildings or parks, the harbour water along the south edge, and
// the story markers (garage, docks, safehouse, club, exchange, yacht) placed on
// open ground. Everything is placed from the seeded generator, so one seed is
// one city. No drawing here — only the layout and the collision helpers.

import { CITY, ROAD, WATER_Y } from './config.js';
import { pick } from './random.js';

const BUILDING_COLORS = ['#232c44', '#2c3550', '#1d2438', '#2a2f4d'];
const CAR_COLORS = ['#ff2e88', '#22e6ff', '#ffb347', '#7dffce', '#e8e8f0', '#ff5a4e', '#b78cff', '#ffd76a'];

export const MARKERS = {
  garage: { x: 480, y: 480, label: 'Vic\'s Garage' },
  docks: { x: 2240, y: 1760, label: 'Pier 9 — Docks' },
  safehouse: { x: 480, y: 1440, label: 'Safehouse' },
  club: { x: 1280, y: 480, label: 'Neon Club' },
  exchange: { x: 2080, y: 480, label: 'The Exchange' },
  yacht: { x: 1280, y: 1790, label: 'The Yacht' },
};

/** Every vertical and horizontal road centre line. */
export function roadLines() {
  const vertical = [];
  const horizontal = [];
  for (let x = ROAD.first; x < CITY.width; x += ROAD.spacing) vertical.push(x);
  for (let y = ROAD.first; y < WATER_Y; y += ROAD.spacing) horizontal.push(y);
  return { vertical, horizontal };
}

export function createCity(random) {
  const { vertical, horizontal } = roadLines();
  const buildings = [];
  const parks = [];
  // Each block is the square between four road centres; buildings sit inside it
  // with a margin, so no building ever touches a road.
  for (let i = 0; i < vertical.length - 1; i += 1) {
    for (let j = 0; j < horizontal.length - 1; j += 1) {
      const x0 = vertical[i] + ROAD.half + 26;
      const y0 = horizontal[j] + ROAD.half + 26;
      const x1 = vertical[i + 1] - ROAD.half - 26;
      const y1 = horizontal[j + 1] - ROAD.half - 26;
      if (x1 - x0 < 60 || y1 - y0 < 60) continue;
      const roll = random();
      if (roll < 0.16) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees: [] });
        const park = parks[parks.length - 1];
        const trees = 3 + Math.floor(random() * 4);
        for (let t = 0; t < trees; t += 1) {
          park.trees.push({ x: x0 + 20 + random() * (x1 - x0 - 40), y: y0 + 20 + random() * (y1 - y0 - 40) });
        }
        continue;
      }
      const two = random() < 0.45 && x1 - x0 > 170;
      if (two) {
        const split = x0 + (x1 - x0) * (0.42 + random() * 0.16);
        buildings.push(makeBuilding(random, x0, y0, split - 12, y1));
        buildings.push(makeBuilding(random, split + 12, y0, x1, y1));
      } else {
        buildings.push(makeBuilding(random, x0, y0, x1, y1));
      }
    }
  }
  // Parked cars along the kerb near the garage, the club and the docks: the
  // player's first wheels, and tempting ones to steal later.
  const parkedSpots = [
    { x: 560, y: 430, angle: 0, color: '#ff2e88' },
    { x: 560, y: 530, angle: 0, color: '#22e6ff' },
    { x: 1360, y: 430, angle: 0, color: '#ffb347' },
    { x: 2160, y: 1710, angle: Math.PI / 2, color: '#7dffce' },
    { x: 400, y: 1390, angle: Math.PI / 2, color: '#e8e8f0' },
    { x: 2000, y: 430, angle: 0, color: '#b78cff' },
  ];
  return {
    width: CITY.width,
    height: CITY.height,
    vertical,
    horizontal,
    buildings,
    parks,
    waterY: WATER_Y,
    markers: MARKERS,
    parkedSpots,
    carColors: CAR_COLORS,
  };
}

function makeBuilding(random, x0, y0, x1, y1) {
  const windows = [];
  const cols = Math.max(1, Math.floor((x1 - x0) / 34));
  const rows = Math.max(1, Math.floor((y1 - y0) / 34));
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      windows.push({
        x: x0 + 12 + c * 34,
        y: y0 + 12 + r * 34,
        lit: random() < 0.45,
      });
    }
  }
  return {
    x: x0,
    y: y0,
    w: x1 - x0,
    h: y1 - y0,
    color: pick(random, BUILDING_COLORS),
    neon: random() < 0.35,
    neonColor: pick(random, ['#ff2e88', '#22e6ff', '#ffb347']),
    windows,
  };
}

/** Push a circle out of every building it overlaps; returns the resolved position. */
export function collideBuildings(city, x, y, radius) {
  let px = x;
  let py = y;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(px, b.x + b.w));
    const cy = Math.max(b.y, Math.min(py, b.y + b.h));
    const dx = px - cx;
    const dy = py - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    if (d2 === 0) {
      // Centre inside the building: push out along the shortest side.
      const left = px - b.x;
      const right = b.x + b.w - px;
      const top = py - b.y;
      const bottom = b.y + b.h - py;
      const m = Math.min(left, right, top, bottom);
      if (m === left) px = b.x - radius;
      else if (m === right) px = b.x + b.w + radius;
      else if (m === top) py = b.y - radius;
      else py = b.y + b.h + radius;
    } else {
      const d = Math.sqrt(d2);
      px = cx + (dx / d) * radius;
      py = cy + (dy / d) * radius;
    }
  }
  return { x: px, y: py };
}

/** Whether a point is inside a building. */
export function insideBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

/** A random point on a road, for traffic spawns. */
export function randomRoadPoint(city, random) {
  if (random() < 0.5) {
    const x = pick(random, city.vertical);
    return { x, y: ROAD.first + random() * (WATER_Y - ROAD.first), axis: 'v' };
  }
  const y = pick(random, city.horizontal);
  return { x: ROAD.first + random() * (CITY.width - ROAD.first), y, axis: 'h' };
}

/** The nearest road point to (x, y): where a police car can appear. */
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of city.vertical) {
    const d = Math.abs(rx - x);
    if (d < bestD) {
      bestD = d;
      best = { x: rx, y, axis: 'v' };
    }
  }
  for (const ry of city.horizontal) {
    const d = Math.abs(ry - y);
    if (d < bestD) {
      bestD = d;
      best = { x, y: ry, axis: 'h' };
    }
  }
  return best;
}
