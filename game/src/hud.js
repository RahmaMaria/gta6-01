// HUD, minimap and menus for Neon Harbor. Everything the player
// needs to read — cash, wanted stars, health, speed, the mission
// objective, the minimap, and the message feed — is drawn here.
import { CONFIG, PALETTE } from "./config.js";
import { districtAt } from "./world.js";
import { currentMission, currentStep, objectiveText, targetDistance } from "./missions.js";
import { playerSpeed } from "./vehicles.js";

const MAP_SIZE = 184;
const MAP_MARGIN = 16;

export function drawHud(ctx, state) {
  const w = state.canvas.width;
  const h = state.canvas.height;

  drawTopLeft(ctx, state);
  drawStars(ctx, state, w);
  drawHealth(ctx, state, w, h);
  drawSpeed(ctx, state, w, h);
  drawMessages(ctx, state, w, h);
  drawMinimap(ctx, state, w, h);
}

function panel(ctx, x, y, pw, ph) {
  ctx.fillStyle = PALETTE.hudBg;
  ctx.beginPath();
  ctx.roundRect(x, y, pw, ph, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(55, 230, 255, 0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawTopLeft(ctx, state) {
  const p = state.player;
  panel(ctx, 14, 14, 340, 74);
  ctx.fillStyle = PALETTE.neonLime;
  ctx.font = "bold 26px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("$" + p.cash.toLocaleString("en-US"), 26, 22);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = "12px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(districtAt(state.world, p.x, p.y) + "  •  Best $" + state.stats.bestCash.toLocaleString("en-US"), 26, 56);
  // Mission objective line.
  const objective = objectiveText(state);
  const dist = targetDistance(state);
  panel(ctx, 14, 96, 340, 46);
  ctx.fillStyle = PALETTE.neonAmber;
  ctx.font = "bold 13px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(objective, 26, 104, 316);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = "12px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(dist > 0 ? dist + " m to target" : "", 26, 122);
}

function drawStars(ctx, state, w) {
  const wanted = state.wanted;
  panel(ctx, w - 218, 14, 204, 66);
  ctx.fillStyle = wanted > 0 ? PALETTE.neonPink : PALETTE.hudDim;
  ctx.font = "bold 12px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(wanted > 0 ? "WANTED" : "CLEAN", w - 206, 20);
  ctx.font = "26px 'Segoe UI', Arial, sans-serif";
  for (let i = 0; i < CONFIG.maxWanted; i++) {
    ctx.fillStyle = i < wanted ? PALETTE.starOn : PALETTE.starOff;
    ctx.fillText("★", w - 206 + i * 40, 38);
  }
}

function drawHealth(ctx, state, w, h) {
  const hp = Math.max(0, state.player.hp);
  panel(ctx, w - 218, h - 58, 204, 44);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = "bold 12px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(state.playerCar ? "ARMOR" : "HEALTH", w - 206, h - 50);
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.beginPath();
  ctx.roundRect(w - 206, h - 32, 180, 10, 5);
  ctx.fill();
  ctx.fillStyle = hp > 50 ? PALETTE.neonLime : hp > 25 ? PALETTE.neonAmber : PALETTE.neonPink;
  ctx.beginPath();
  ctx.roundRect(w - 206, h - 32, 180 * (hp / 100), 10, 5);
  ctx.fill();
}

function drawSpeed(ctx, state, w, h) {
  if (!state.playerCar) return;
  const kmh = Math.round(playerSpeed(state) * 0.32);
  panel(ctx, w - 218, h - 112, 204, 44);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = "bold 26px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(String(kmh), w - 66, h - 106);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = "12px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("km/h", w - 58, h - 98);
  ctx.fillText(state.playerCar.kind.toUpperCase(), w - 206, h - 98);
}

function drawMessages(ctx, state, w, h) {
  // Centred along the bottom edge, clear of the minimap and health bar.
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "13px 'Segoe UI', Arial, sans-serif";
  let y = h - 40 - state.messages.length * 28;
  for (const msg of state.messages) {
    ctx.globalAlpha = Math.min(1, msg.t);
    const tw = ctx.measureText(msg.text).width;
    const x = Math.round((w - tw - 18) / 2);
    ctx.fillStyle = PALETTE.hudBg;
    ctx.fillRect(x, y - 4, tw + 18, 24);
    ctx.fillStyle = PALETTE.hudText;
    ctx.fillText(msg.text, w / 2, y);
    y += 28;
  }
  ctx.globalAlpha = 1;
}

function drawMinimap(ctx, state, w, h) {
  const size = MAP_SIZE;
  const x0 = MAP_MARGIN;
  const y0 = h - MAP_MARGIN - size;
  const scale = size / state.world.size;
  panel(ctx, x0 - 6, y0 - 6, size + 12, size + 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  // Water and ground.
  ctx.fillStyle = "#16242c";
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = "#0e4a6b";
  ctx.fillRect(x0 + (state.world.size - 96) * scale, y0, size, size);
  ctx.fillRect(x0, y0 + (state.world.size - 96) * scale, size, size);
  // Roads.
  ctx.strokeStyle = "rgba(216, 194, 90, 0.55)";
  ctx.lineWidth = 2;
  for (const r of state.world.roads) {
    ctx.beginPath();
    ctx.moveTo(x0 + r * scale, y0);
    ctx.lineTo(x0 + r * scale, y0 + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0, y0 + r * scale);
    ctx.lineTo(x0 + size, y0 + r * scale);
    ctx.stroke();
  }
  // Mission target.
  const step = currentStep(state);
  if (step) {
    const pulse = 4 + Math.sin(state.time * 5) * 2;
    ctx.fillStyle = PALETTE.neonAmber;
    ctx.beginPath();
    ctx.arc(x0 + step.target.x * scale, y0 + step.target.y * scale, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Target car for mission 2.
  if (state.missions.targetCar && !state.missions.done) {
    const car = state.missions.targetCar;
    ctx.fillStyle = "#ff5d73";
    ctx.beginPath();
    ctx.arc(x0 + car.x * scale, y0 + car.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cops in red.
  ctx.fillStyle = "#ff4757";
  for (const cop of state.cops) {
    ctx.beginPath();
    ctx.arc(x0 + cop.x * scale, y0 + cop.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const px = x0 + state.player.x * scale;
  const py = y0 + state.player.y * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(state.player.angle);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  // North label.
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = "bold 11px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("MERIDIAN BAY", x0 + 2, y0 - 22);
}

// ---- Menus ----

function menuTitle(ctx, state, title, subtitle) {
  const w = state.canvas.width;
  const h = state.canvas.height;
  ctx.fillStyle = "rgba(5, 8, 18, 0.62)";
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = PALETTE.neonPink;
  ctx.font = "bold 64px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(title, w / 2, h / 2 - 120);
  ctx.fillStyle = PALETTE.neonCyan;
  ctx.font = "bold 26px 'Segoe UI', Arial, sans-serif";
  ctx.fillText(subtitle, w / 2, h / 2 - 70);
}

export function drawStartScreen(ctx, state) {
  menuTitle(ctx, state, "NEON HARBOR", "— MERIDIAN BAY —");
  const w = state.canvas.width;
  const h = state.canvas.height;
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = "17px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  const lines = [
    "Mara Voss owes the wrong people money. Work it off — five jobs across the bay.",
    "",
    "WASD / Arrows — move & drive      E — enter / steal car      F / Click — punch",
    "SPACE — shoot      SHIFT — sprint      SPACE (in car) — handbrake      M — mute",
    "",
    "Steal cars, outrun the police, finish all five missions. Best cash: $" + state.stats.bestCash.toLocaleString("en-US"),
  ];
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, h / 2 - 20 + i * 28);
  });
  const blink = Math.sin(state.time * 4) > 0;
  if (blink) {
    ctx.fillStyle = PALETTE.neonAmber;
    ctx.font = "bold 24px 'Segoe UI', Arial, sans-serif";
    ctx.fillText("PRESS ENTER TO START", w / 2, h / 2 + 170);
  }
}

export function drawDeadScreen(ctx, state) {
  menuTitle(ctx, state, "WASTED", "Mara went down in " + districtAt(state.world, state.player.x, state.player.y));
  const w = state.canvas.width;
  const h = state.canvas.height;
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = "18px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Cash kept: $" + state.player.cash.toLocaleString("en-US") + "   •   Missions done: " + state.stats.missionsDone, w / 2, h / 2 - 10);
  ctx.fillStyle = PALETTE.neonAmber;
  ctx.font = "bold 22px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("PRESS R TO GET BACK UP", w / 2, h / 2 + 60);
}

export function drawCompleteScreen(ctx, state) {
  menuTitle(ctx, state, "DEBT PAID", "Mara Voss owns Meridian Bay now");
  const w = state.canvas.width;
  const h = state.canvas.height;
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = "18px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  const lines = [
    "All five missions complete. The Benefactor tore up the ledger.",
    "Final cash: $" + state.player.cash.toLocaleString("en-US"),
    "Cars stolen: " + state.stats.carsStolen + "   •   Shots fired: " + state.stats.shotsFired,
    "Times busted: " + state.stats.busted + "   •   Missions failed: " + state.stats.failedMissions,
    "",
    "PRESS R TO PLAY AGAIN — the bay never sleeps.",
  ];
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, h / 2 - 10 + i * 30);
  });
}

export function drawPausedScreen(ctx, state) {
  menuTitle(ctx, state, "PAUSED", "Meridian Bay waits for no one — except now");
  const w = state.canvas.width;
  const h = state.canvas.height;
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = "18px 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PRESS P TO RESUME", w / 2, h / 2 + 20);
}
