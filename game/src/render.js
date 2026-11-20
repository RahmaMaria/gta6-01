// Canvas 2D rendering for Neon Harbor: camera, ground, roads,
// buildings with neon signs, water, traffic, pedestrians, the player,
// mission markers and combat effects. Top-down, dusk-lit, sun-soaked.
import { PALETTE } from "./config.js";
import { currentStep } from "./missions.js";

export function createCamera() {
  return { x: 0, y: 0, zoom: 1.0 };
}

// Follow the player (or their car) with a soft lag, clamped to the map.
export function updateCamera(state, dt) {
  const cam = state.camera;
  const targetX = state.player.x;
  const targetY = state.player.y;
  const k = 1 - Math.exp(-6 * dt);
  cam.x += (targetX - cam.x) * k;
  cam.y += (targetY - cam.y) * k;
  const vw = state.canvas.width / 2 / cam.zoom;
  const vh = state.canvas.height / 2 / cam.zoom;
  cam.x = Math.max(vw - 100, Math.min(state.world.size - vw + 100, cam.x));
  cam.y = Math.max(vh - 100, Math.min(state.world.size - vh + 100, cam.y));
}

export function render(state) {
  const ctx = state.ctx;
  const canvas = state.canvas;
  const cam = state.camera;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0b0e1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  drawGround(ctx, state);
  drawRoads(ctx, state);
  drawBuildings(ctx, state);
  drawProps(ctx, state);
  drawMissionMarker(ctx, state);
  drawCars(ctx, state);
  drawCops(ctx, state);
  drawPeds(ctx, state);
  drawPlayer(ctx, state);
  drawEffects(ctx, state);

  ctx.restore();

  // Dusk vignette over the whole frame.
  const grad = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.42,
    canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.75,
  );
  grad.addColorStop(0, "rgba(10, 8, 24, 0)");
  grad.addColorStop(1, "rgba(10, 8, 24, 0.34)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawGround(ctx, state) {
  const world = state.world;
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, 0, world.size, world.size);
  // Alternating block tint so the grid reads at a glance.
  ctx.fillStyle = PALETTE.groundAlt;
  for (let bx = 0; bx < world.roadCount - 1; bx++) {
    for (let by = 0; by < world.roadCount - 1; by++) {
      if ((bx + by) % 2 === 0) {
        const x0 = world.roads[bx] + world.roadHalf;
        const y0 = world.roads[by] + world.roadHalf;
        const w = world.roads[bx + 1] - world.roads[bx] - world.roadWidth;
        ctx.fillRect(x0, y0, w, w);
      }
    }
  }
  // The bay: water along the south and east edges with a sand rim.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, world.water.south - 14, world.size, 14);
  ctx.fillRect(world.water.east - 14, 0, 14, world.size);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(0, world.water.south, world.size, world.size - world.water.south);
  ctx.fillRect(world.water.east, 0, world.size - world.water.east, world.size);
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(0, world.water.south + 48, world.size, world.size - world.water.south - 48);
  ctx.fillRect(world.water.east + 48, 0, world.size - world.water.east - 48, world.size);
  // A few wave lines in the bay.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const y = world.water.south + 24 + i * 10;
    ctx.beginPath();
    ctx.moveTo(120 + i * 30, y);
    ctx.lineTo(300 + i * 30, y);
    ctx.stroke();
  }
}

function drawRoads(ctx, state) {
  const world = state.world;
  const half = world.roadHalf;
  ctx.fillStyle = PALETTE.road;
  for (const r of world.roads) {
    ctx.fillRect(r - half, 0, half * 2, world.size);
    ctx.fillRect(0, r - half, world.size, half * 2);
  }
  // Sidewalk rims.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const r of world.roads) {
    ctx.fillRect(r - half - 8, 0, 8, world.size);
    ctx.fillRect(r + half, 0, 8, world.size);
    ctx.fillRect(0, r - half - 8, world.size, 8);
    ctx.fillRect(0, r + half, world.size, 8);
  }
  // Dashed centre lines.
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  for (const r of world.roads) {
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(r, world.size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(world.size, r);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawBuildings(ctx, state) {
  for (const b of state.world.buildings) {
    // Fake height: a soft offset shadow to the south-east.
    if (b.height > 0) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(b.x + b.height * 0.5, b.y + b.height * 0.5, b.w, b.h);
    }
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = PALETTE.buildingEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Rooftop detail: a lighter inner slab and window dots.
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = "rgba(255, 214, 120, 0.5)";
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 3 + b.windows) % 3 === 0) {
          ctx.fillRect(b.x + 10 + i * 26, b.y + 10 + j * 26, 8, 8);
        }
      }
    }
    // Neon sign on one edge.
    if (b.neon) {
      ctx.fillStyle = b.neon;
      ctx.fillRect(b.x + b.w / 2 - 16, b.y - 3, 32, 6);
      ctx.fillRect(b.x + b.w / 2 - 16, b.y + b.h - 3, 32, 6);
    }
  }
}

function drawProps(ctx, state) {
  // Palm trees: a dark trunk dot and a green crown.
  for (const t of state.world.trees) {
    ctx.fillStyle = "#2f7d4f";
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3fae6a";
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.size * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Lamps: small amber dots at intersections.
  ctx.fillStyle = "#ffd23e";
  for (const lamp of state.world.lamps) {
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMissionMarker(ctx, state) {
  const step = currentStep(state);
  if (!step || state.state !== "play") return;
  const t = step.target;
  const pulse = 1 + Math.sin(state.time * 4) * 0.12;
  // A beacon column so the target reads from anywhere on screen.
  const grad = ctx.createLinearGradient(t.x, t.y - 220, t.x, t.y);
  grad.addColorStop(0, "rgba(255, 179, 71, 0)");
  grad.addColorStop(1, "rgba(255, 179, 71, 0.5)");
  ctx.fillStyle = grad;
  ctx.fillRect(t.x - 14, t.y - 220, 28, 220);
  ctx.strokeStyle = PALETTE.neonAmber;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(t.x, t.y, 34 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 179, 71, 0.25)";
  ctx.beginPath();
  ctx.arc(t.x, t.y, 34 * pulse, 0, Math.PI * 2);
  ctx.fill();
  // Down arrow.
  ctx.fillStyle = PALETTE.neonAmber;
  const bob = Math.sin(state.time * 4) * 6;
  ctx.beginPath();
  ctx.moveTo(t.x, t.y - 52 + bob);
  ctx.lineTo(t.x - 10, t.y - 68 + bob);
  ctx.lineTo(t.x + 10, t.y - 68 + bob);
  ctx.closePath();
  ctx.fill();
}

function drawCarShape(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.roundRect(-24, -10, 52, 26, 8);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.wrecked ? "#22242a" : car.color;
  ctx.beginPath();
  ctx.roundRect(-26, -13, 52, 26, 8);
  ctx.fill();
  // Cabin and windshield.
  ctx.fillStyle = car.wrecked ? "#111" : "rgba(180, 220, 255, 0.85)";
  ctx.beginPath();
  ctx.roundRect(-6, -10, 16, 20, 4);
  ctx.fill();
  ctx.fillStyle = "rgba(20, 24, 36, 0.9)";
  ctx.fillRect(8, -11, 4, 22);
  // Headlights.
  ctx.fillStyle = "#fff7c0";
  ctx.fillRect(24, -11, 3, 5);
  ctx.fillRect(24, 6, 3, 5);
  // Brake lights.
  ctx.fillStyle = "#ff2e4d";
  ctx.fillRect(-27, -11, 3, 5);
  ctx.fillRect(-27, 6, 3, 5);
  ctx.restore();
}

function drawCars(ctx, state) {
  for (const car of state.cars) {
    if (car === state.playerCar) continue;
    drawCarShape(ctx, car);
    if (car.target) {
      // The mission-2 sportscar gets a pink ring.
      ctx.strokeStyle = PALETTE.neonPink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(car.x, car.y, 40 + Math.sin(state.time * 4) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (car.wrecked) {
      ctx.fillStyle = "rgba(60, 60, 66, 0.6)";
      ctx.beginPath();
      ctx.arc(car.x, car.y, 30, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (state.playerCar) {
    drawCarShape(ctx, state.playerCar);
    // A soft ring marks the hero car so it reads at a glance.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(state.playerCar.x, state.playerCar.y, 34, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawCops(ctx, state) {
  for (const cop of state.cops) {
    drawCarShape(ctx, cop);
    // Flashing light bar.
    const on = Math.floor(state.time * 6) % 2 === 0;
    ctx.fillStyle = on ? "#ff2e4d" : "#2e7bff";
    ctx.beginPath();
    ctx.arc(cop.x - 2, cop.y - 8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = on ? "#2e7bff" : "#ff2e4d";
    ctx.beginPath();
    ctx.arc(cop.x - 2, cop.y + 8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MBPD", cop.x, cop.y - 20);
  }
}

function drawPeds(ctx, state) {
  for (const ped of state.peds) {
    if (ped.down > 0) {
      // Lying flat.
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    const bob = Math.sin(ped.bob) * 2;
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y + 8, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y + bob * 0.3, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2c89b";
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3 + bob * 0.3, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (state.playerCar) return;
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 9, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Mara: teal jacket, dark hair, facing her angle.
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.fillStyle = "#0ea5a5";
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f2c89b";
  ctx.beginPath();
  ctx.arc(4, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1c2430";
  ctx.beginPath();
  ctx.arc(1, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  // Gun in hand when recently fired.
  if (p.shootCd > 0.1) {
    ctx.fillStyle = "#222";
    ctx.fillRect(8, -2, 10, 3);
  }
  ctx.restore();
  // A soft ring so the player never gets lost in a crowd.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
  ctx.stroke();
}

function drawEffects(ctx, state) {
  for (const e of state.effects) {
    const t = e.life / e.max;
    if (e.kind === "muzzle") {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle || 0);
      ctx.fillStyle = "rgba(255, 220, 90, " + t + ")";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(26, -6);
      ctx.lineTo(26, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (e.kind === "spark") {
      ctx.fillStyle = "rgba(255, 200, 60, " + t + ")";
      ctx.beginPath();
      ctx.arc(e.x, e.y, 6 * t + 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === "smoke") {
      ctx.fillStyle = "rgba(120, 120, 130, " + t * 0.6 + ")";
      ctx.beginPath();
      ctx.arc(e.x, e.y, 14 + (1 - t) * 18, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === "boom") {
      ctx.fillStyle = "rgba(255, 140, 40, " + t + ")";
      ctx.beginPath();
      ctx.arc(e.x, e.y, 50 * t + 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 230, 120, " + t + ")";
      ctx.beginPath();
      ctx.arc(e.x, e.y, 26 * t + 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === "hit" || e.kind === "swing") {
      ctx.strokeStyle = "rgba(255, 255, 255, " + t + ")";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 12 * (1 - t) + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
