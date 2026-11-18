// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 camera window is scaled to fit the window and centred, the margin
// filled with the backdrop colour. The camera follows the player through
// Meridian Bay; the HUD and the screen panels are drawn on top in logical
// coordinates. Flat shapes and canvas text — no images, no network.

import { CAR, CITY, FONT, PALETTE, PED, PLAYER, ROAD, VIEW } from './config.js';
import { createHud } from './hud.js';
import { MISSIONS } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const hud = createHud();
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align = 'left') {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function drawCity(state) {
    const city = state.city;
    // Ground and water.
    context.fillStyle = PALETTE.ground;
    context.fillRect(0, 0, CITY.width, CITY.height);
    context.fillStyle = PALETTE.water;
    context.fillRect(0, city.waterY, CITY.width, CITY.height - city.waterY);
    context.fillStyle = PALETTE.waterLine;
    context.fillRect(0, city.waterY, CITY.width, 3);
    // Parks.
    for (const park of city.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x, park.y, park.w, park.h);
      context.fillStyle = PALETTE.parkTree;
      for (const tree of park.trees) {
        context.beginPath();
        context.arc(tree.x, tree.y, 9, 0, Math.PI * 2);
        context.fill();
      }
    }
    // Roads.
    context.fillStyle = PALETTE.road;
    for (const x of city.vertical) {
      context.fillRect(x - ROAD.half, 0, ROAD.half * 2, city.waterY);
    }
    for (const y of city.horizontal) {
      context.fillRect(0, y - ROAD.half, CITY.width, ROAD.half * 2);
    }
    // Lane dashes down the middle of each road.
    context.fillStyle = PALETTE.lane;
    for (const x of city.vertical) {
      for (let y = 8; y < city.waterY - 8; y += 56) {
        context.fillRect(x - 2, y, 4, 28);
      }
    }
    for (const y of city.horizontal) {
      for (let x = 8; x < CITY.width - 8; x += 56) {
        context.fillRect(x, y - 2, 28, 4);
      }
    }
    // Buildings: body, roof edge, windows, a neon strip on some.
    for (const b of city.buildings) {
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.strokeStyle = PALETTE.roof;
      context.lineWidth = 3;
      context.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
      for (const w of b.windows) {
        context.fillStyle = w.lit ? PALETTE.windowLit : PALETTE.windowDark;
        context.fillRect(w.x, w.y, 12, 12);
      }
      if (b.neon) {
        context.fillStyle = b.neonColor;
        context.fillRect(b.x, b.y + b.h - 5, b.w, 5);
      }
    }
  }

  function drawMarker(state) {
    const def = MISSIONS[state.mission.index];
    if (!def || !def.marker) return;
    const m = state.city.markers[def.marker];
    const pulse = 1 + Math.sin(state.time * 4) * 0.18;
    context.strokeStyle = PALETTE.marker;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(m.x, m.y, 46 * pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.marker;
    context.beginPath();
    context.arc(m.x, m.y, 7, 0, Math.PI * 2);
    context.fill();
    text(m.label, m.x, m.y - 58, 16, PALETTE.marker, 'center');
  }

  function drawCar(car, time, isPlayer) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    // Body: 44 long, 22 wide, nose to the right.
    context.fillStyle = car.color;
    context.beginPath();
    context.roundRect(-22, -11, 44, 22, 6);
    context.fill();
    context.fillStyle = 'rgba(10, 14, 24, 0.85)';
    context.beginPath();
    context.roundRect(-6, -9, 14, 18, 3);
    context.fill();
    // Headlights.
    context.fillStyle = '#fff6c9';
    context.fillRect(20, -9, 3, 5);
    context.fillRect(20, 4, 3, 5);
    context.fillStyle = '#ff2e2e';
    context.fillRect(-23, -9, 3, 5);
    context.fillRect(-23, 4, 3, 5);
    if (car.kind === 'police') {
      const phase = Math.floor(time * 6 + car.sirenPhase) % 2;
      context.fillStyle = phase === 0 ? PALETTE.policeLightR : PALETTE.policeLightB;
      context.fillRect(-4, -12, 8, 5);
      context.fillStyle = phase === 0 ? PALETTE.policeLightB : PALETTE.policeLightR;
      context.fillRect(-4, 7, 8, 5);
    }
    if (isPlayer) {
      context.strokeStyle = PALETTE.player;
      context.lineWidth = 2.5;
      context.beginPath();
      context.roundRect(-24, -13, 48, 26, 7);
      context.stroke();
    }
    context.restore();
  }

  function drawWorld(state) {
    drawCity(state);
    drawMarker(state);
    // Pedestrians.
    for (const ped of state.peds) {
      if (ped.down) continue;
      const bob = Math.sin(ped.phase) * 1.5;
      context.fillStyle = ped.shirt;
      context.beginPath();
      context.arc(ped.x, ped.y + bob * 0.3, PED.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#1b2740';
      context.beginPath();
      context.arc(ped.x, ped.y + bob * 0.3 - 3, 4, 0, Math.PI * 2);
      context.fill();
    }
    // Thugs.
    for (const thug of state.thugs) {
      context.fillStyle = PALETTE.thug;
      context.beginPath();
      context.arc(thug.x, thug.y, 15, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#2a0a0a';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(thug.x, thug.y);
      context.lineTo(thug.x + Math.cos(thug.angle) * 24, thug.y + Math.sin(thug.angle) * 24);
      context.stroke();
    }
    // Cars.
    const playerCarId = state.player.carId;
    for (const car of state.cars) {
      drawCar(car, state.time, car.id === playerCarId);
    }
    // The player, on foot: a cyan figure with an aim tick; blinks while invulnerable.
    const player = state.player;
    if (player.onFoot && (player.invulnerable <= 0 || Math.floor(player.invulnerable * 10) % 2 === 1)) {
      context.fillStyle = PALETTE.player;
      context.beginPath();
      context.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.playerCore;
      context.beginPath();
      context.arc(player.x, player.y, 5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.player;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(player.x + Math.cos(player.aimAngle) * 14, player.y + Math.sin(player.aimAngle) * 14);
      context.lineTo(player.x + Math.cos(player.aimAngle) * 26, player.y + Math.sin(player.aimAngle) * 26);
      context.stroke();
    }
    // Bullets.
    context.fillStyle = PALETTE.bullet;
    for (const b of state.bullets) {
      context.beginPath();
      context.arc(b.x, b.y, 4, 0, Math.PI * 2);
      context.fill();
    }
    // Particles.
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.max);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // Floating texts.
    for (const t of state.texts) {
      context.globalAlpha = Math.min(1, t.life);
      text(t.text, t.x, t.y, 18, PALETTE.gold, 'center');
    }
    context.globalAlpha = 1;
  }

  /** Paint one frame: the world through the camera, then the HUD or a panel. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#05070f';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const cam = state.camera;
    context.setTransform(
      view.scale, 0, 0, view.scale,
      view.x + (VIEW.width / 2 - cam.x) * view.scale,
      view.y + (VIEW.height / 2 - cam.y) * view.scale,
    );
    drawWorld(state);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      hud.drawHud(context, state);
    }
    if (screen !== SCREEN_PLAY) {
      hud.drawScreen(context, screen, state, best);
    }
  }

  /** World coordinates under a CSS-pixel mouse position, for aiming. */
  function toWorld(clientX, clientY, state) {
    const rect = canvas.getBoundingClientRect();
    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;
    const logicalX = (cssX * (canvas.width / rect.width) - view.x) / view.scale;
    const logicalY = (cssY * (canvas.height / rect.height) - view.y) / view.scale;
    return {
      x: logicalX - VIEW.width / 2 + state.camera.x,
      y: logicalY - VIEW.height / 2 + state.camera.y,
    };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toWorld, view };
}
