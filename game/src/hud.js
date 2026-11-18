// The HUD and the screens: health, cash, wanted stars, the mission objective,
// the dialogue line, the minimap, and the title / paused / busted / victory
// panels. It draws in logical 1280x720 coordinates on the same canvas the
// renderer owns; the renderer hands it the context.

import { CITY, FONT, FONT_DISPLAY, PALETTE, VIEW, WATER_Y } from './config.js';
import { MISSIONS, missionLine } from './missions.js';
import { wantedStars } from './wanted.js';

const MINIMAP = { w: 220, h: 166, x: VIEW.width - 236, y: 16 };

function fonts() {
  const cache = new Map();
  return function font(size, display = false) {
    const key = `${size}:${display}`;
    if (!cache.has(key)) cache.set(key, `${size}px ${display ? FONT_DISPLAY : FONT}`);
    return cache.get(key);
  };
}

export function createHud() {
  const getFont = fonts();

  function text(ctx, value, x, y, size, color, align = 'left', display = false) {
    ctx.font = getFont(size, display);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function panel(ctx, title, lines, prompt) {
    const width = 640;
    const lineH = 32;
    const height = 150 + lines.length * lineH + 64;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    text(ctx, title, VIEW.width / 2, y + 78, 46, PALETTE.text, 'center', true);
    for (let i = 0; i < lines.length; i += 1) {
      text(ctx, lines[i], VIEW.width / 2, y + 140 + i * lineH, 20, PALETTE.muted, 'center');
    }
    text(ctx, prompt, VIEW.width / 2, y + height - 36, 22, PALETTE.gold, 'center');
  }

  function drawMinimap(ctx, state) {
    const scale = MINIMAP.w / CITY.width;
    const mh = CITY.height * scale;
    const { x, y } = MINIMAP;
    ctx.fillStyle = 'rgba(8, 10, 26, 0.88)';
    ctx.fillRect(x - 6, y - 6, MINIMAP.w + 12, mh + 12);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 6, y - 6, MINIMAP.w + 12, mh + 12);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x, y + WATER_Y * scale, MINIMAP.w, mh - WATER_Y * scale);
    ctx.strokeStyle = 'rgba(120, 140, 180, 0.5)';
    ctx.lineWidth = 1;
    for (const rx of state.city.vertical) {
      ctx.beginPath();
      ctx.moveTo(x + rx * scale, y);
      ctx.lineTo(x + rx * scale, y + WATER_Y * scale);
      ctx.stroke();
    }
    for (const ry of state.city.horizontal) {
      ctx.beginPath();
      ctx.moveTo(x, y + ry * scale);
      ctx.lineTo(x + MINIMAP.w, y + ry * scale);
      ctx.stroke();
    }
    const def = MISSIONS[state.mission.index];
    if (def && def.marker) {
      const m = state.city.markers[def.marker];
      const pulse = 3 + Math.sin(state.time * 5) * 1.5;
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(x + m.x * scale, y + m.y * scale, pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      ctx.fillStyle = '#ff2e2e';
      ctx.fillRect(x + car.x * scale - 2, y + car.y * scale - 2, 4, 4);
    }
    for (const thug of state.thugs) {
      ctx.fillStyle = PALETTE.thug;
      ctx.fillRect(x + thug.x * scale - 2, y + thug.y * scale - 2, 4, 4);
    }
    const p = state.player;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(x + p.x * scale, y + p.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(x + p.x * scale, y + p.y * scale, 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawHud(ctx, state) {
    const player = state.player;
    // Top-left: health bar, cash, mission.
    ctx.fillStyle = 'rgba(8, 10, 26, 0.72)';
    ctx.fillRect(14, 14, 300, 96);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.strokeRect(14, 14, 300, 96);
    text(ctx, `♥ ${Math.ceil(player.health)}`, 26, 44, 22, player.health > 30 ? PALETTE.text : PALETTE.danger);
    ctx.fillStyle = '#222c44';
    ctx.fillRect(110, 28, 180, 14);
    ctx.fillStyle = player.health > 30 ? '#37d67a' : PALETTE.danger;
    ctx.fillRect(110, 28, 180 * Math.max(0, player.health / 100), 14);
    text(ctx, `$${player.cash}`, 26, 74, 22, PALETTE.gold);
    const def = MISSIONS[state.mission.index];
    if (def) {
      text(ctx, `JOB ${state.mission.index + 1}/5 — ${def.title}`, 26, 100, 17, PALETTE.neonCyan);
    }
    // Top-centre: wanted stars.
    text(ctx, wantedStars(state.wanted), VIEW.width / 2, 46, 30, PALETTE.gold, 'center');
    // Objective line under the stars.
    if (def) {
      text(ctx, def.objective, VIEW.width / 2, 76, 17, PALETTE.text, 'center');
    }
    drawMinimap(ctx, state);
    // Bottom-centre: the mission's dialogue while it is showing.
    const line = missionLine(state.mission, state.mission.elapsed);
    if (line) {
      ctx.fillStyle = 'rgba(8, 10, 26, 0.78)';
      const w = ctx.measureText(line).width;
      ctx.fillRect(VIEW.width / 2 - 320, VIEW.height - 92, 640, 40);
      text(ctx, line, VIEW.width / 2, VIEW.height - 64, 18, PALETTE.text, 'center');
      void w;
    }
    // Bottom-left: what the player can do right now.
    if (player.onFoot) {
      let near = null;
      let nearD = 78;
      for (const car of state.cars) {
        if (car.kind === 'police') continue;
        const d = Math.hypot(car.x - player.x, car.y - player.y);
        if (d < nearD) {
          nearD = d;
          near = car;
        }
      }
      if (near) {
        text(ctx, near.kind === 'traffic' ? 'E — steal this car  (★)' : 'E — get in', 24, VIEW.height - 24, 18, PALETTE.gold);
      } else {
        text(ctx, 'WASD move · mouse aim · click shoot', 24, VIEW.height - 24, 16, PALETTE.muted);
      }
    } else {
      const car = state.cars.find((c) => c.id === player.carId);
      const speed = car ? Math.abs(Math.round(car.speed * 0.12)) : 0;
      text(ctx, `${speed} mph   ·   E — get out   ·   P — pause   ·   M — mute`, 24, VIEW.height - 24, 16, PALETTE.muted);
    }
  }

  function drawScreen(ctx, screen, state, best) {
    const player = state.player;
    if (screen === 'title') {
      panel(ctx, 'NEON HARBOR', [
        'Meridian Bay — an open-world crime story in 2D.',
        'Five jobs for Rook\'s crew. Steal cars, lose the cops,',
        'make the drop — and take the whole bay.',
        '',
        'WASD / arrows — move & drive · E — enter / exit car',
        'Mouse — aim · Click — shoot · P — pause · M — mute',
        '',
        `Best cash: $${best}`,
      ], 'Press Enter or click to start');
      return;
    }
    if (screen === 'paused') {
      panel(ctx, 'Paused', ['The bay will wait for you.'], 'Press P to resume');
      return;
    }
    if (screen === 'over') {
      panel(ctx, 'BUSTED', [
        'The Meridian Bay PD finally caught up with you.',
        '',
        `Cash earned: $${player.cash}`,
        `Best cash: $${best}`,
      ], 'Press R to run it back');
      return;
    }
    if (screen === 'win') {
      panel(ctx, 'HARBOR KING', [
        'The yacht is yours. Meridian Bay is yours.',
        '',
        `Cash earned: $${player.cash}`,
        `Best cash: $${best}`,
        `Time: ${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`,
      ], 'Press R to play again');
    }
  }

  return { drawHud, drawScreen };
}
