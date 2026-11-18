// The engine: the game's rules and state, with no drawing and no browser in
// it. It owns the city, the player, the cars, the pedestrians, the thugs, the
// bullets, the wanted level and the mission chain, and advances them one fixed
// step at a time, returning what happened as bit flags so the caller can react
// without the engine knowing about screens or sound. Nothing here allocates
// after createEngine returns, except the pools it already holds.

import { BULLET, CAR, CITY, MISSION_REWARDS, PED, PLAYER, STEP, THUG, VIEW, WANTED, WATER_Y } from './config.js';
import { createRandom } from './random.js';
import { createCity, collideBuildings, insideBuilding } from './city.js';
import { createPlayer, stepPlayer } from './player.js';
import { createTraffic, createParked, stepTrafficCar, spawnPolice, stepPoliceCar, separateCars } from './vehicles.js';
import { createPeds, stepPeds } from './pedestrians.js';
import { createWanted, addWanted, stepWanted } from './wanted.js';
import { MISSIONS, markerDistance } from './missions.js';

export const EVENT_OVER = 1;
export const EVENT_WIN = 2;
export const EVENT_MISSION = 4;
export const EVENT_HIT = 8;

const MARKER_RADIUS = 70;
const THUG_SPAWN_RADIUS = 600;

export function createEngine(seed, startMission = 0, startCash = 0) {
  const rng = createRandom(seed);
  const city = createCity(rng);
  const state = {
    seed,
    city,
    player: createPlayer(430, 400),
    cars: [],
    peds: [],
    thugs: [],
    bullets: [],
    particles: [],
    texts: [],
    wanted: createWanted(),
    mission: { index: startMission, elapsed: 0, thugsSpawned: false },
    time: 0,
    camera: { x: 430, y: 400 },
    over: false,
    won: false,
    overReason: '',
    stats: { carsStolen: 0, pedsHit: 0, shotsFired: 0 },
    policeTimer: 0,
  };
  state.player.cash = startCash;
  state.cars = [...createTraffic(city, rng, 14), ...createParked(city)];
  state.peds = createPeds(city, rng, 26);
  const engine = { state, rng, reset, step };
  applyMissionStart(state);

  function reset() {
    const fresh = createEngine(seed, 0, 0);
    for (const key of Object.keys(state)) {
      if (key === 'rng') continue;
      state[key] = fresh.state[key];
    }
    engine.rng = fresh.rng;
  }

  function applyMissionStart(st) {
    const def = MISSIONS[st.mission.index];
    if (!def) return;
    st.mission.elapsed = 0;
    st.mission.thugsSpawned = false;
    if (def.wantedOnStart) addWanted(st.wanted, def.wantedOnStart);
  }

  function spark(x, y, color, n) {
    for (let i = 0; i < n; i += 1) {
      const a = rng() * Math.PI * 2;
      const s = 40 + rng() * 160;
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.35 + rng() * 0.35,
        max: 0.7,
        color,
        size: 2 + rng() * 3,
      });
    }
  }

  function floatText(x, y, text) {
    state.texts.push({ x, y, text, life: 1.6 });
  }

  function fireBullet(x, y, angle, from) {
    const speed = from === 'player' ? PLAYER.bulletSpeed : THUG.bulletSpeed;
    state.bullets.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      from,
      life: BULLET.life,
    });
    if (from === 'player') state.stats.shotsFired += 1;
  }

  function crime(amount) {
    addWanted(state.wanted, amount);
  }

  function completeMission(audio) {
    const def = MISSIONS[state.mission.index];
    state.player.cash += def.reward;
    floatText(state.player.x, state.player.y - 40, `+$${def.reward} — ${def.title} complete`);
    spark(state.player.x, state.player.y, '#ffd76a', 16);
    audio.mission();
    state.mission.index += 1;
    if (state.mission.index >= MISSIONS.length) {
      state.won = true;
      return EVENT_WIN | EVENT_MISSION;
    }
    applyMissionStart(state);
    return EVENT_MISSION;
  }

  function spawnThugs() {
    const marker = state.city.markers.exchange;
    const spots = [
      { x: marker.x - 90, y: marker.y - 60 },
      { x: marker.x + 80, y: marker.y - 90 },
      { x: marker.x + 40, y: marker.y + 100 },
    ];
    for (const spot of spots) {
      state.thugs.push({
        x: spot.x,
        y: spot.y,
        health: THUG.health,
        fireCd: 0.5 + rng() * 0.8,
        angle: 0,
      });
    }
    state.mission.thugsSpawned = true;
    floatText(marker.x, marker.y - 80, 'Rivals at the Exchange!');
  }

  /**
   * One fixed step. `drive` is { move, aimAngle, firing, enterPressed }.
   * With `harmless` set (the title screen's backdrop) the city lives but
   * nothing scores, no crime counts and no mission advances.
   */
  function step(dt, drive, audio, harmless = false) {
    let events = 0;
    state.time += dt;
    const player = state.player;

    if (harmless) {
      // Title backdrop: traffic and walkers move, the camera drifts over the bay.
      for (const car of state.cars) if (car.kind === 'traffic') stepTrafficCar(car, state.city, rng, dt);
      stepPeds(state.peds, state.city, [], dt);
      state.camera.x = 1280 + Math.cos(state.time * 0.05) * 520;
      state.camera.y = 960 + Math.sin(state.time * 0.05) * 320;
      stepParticles(dt);
      return 0;
    }

    // --- the player (on foot or driving)
    const driven = stepPlayer(state, state.city, drive, dt, {
      fireBullet, crime, audio, spark, text: floatText,
    });

    // --- traffic
    for (const car of state.cars) {
      if (car.kind === 'traffic') stepTrafficCar(car, state.city, rng, dt);
    }
    // Keep cars from piling through each other.
    for (let i = 0; i < state.cars.length; i += 1) {
      for (let j = i + 1; j < state.cars.length; j += 1) {
        separateCars(state.cars[i], state.cars[j]);
      }
    }

    // --- pedestrians, and what a speeding car does to one
    const threats = state.cars.filter((c) => (c.kind === 'player' || c.kind === 'police') && Math.abs(c.speed) > 120);
    stepPeds(state.peds, state.city, threats, dt);
    if (driven) {
      for (const ped of state.peds) {
        if (ped.down) continue;
        if (Math.hypot(ped.x - driven.x, ped.y - driven.y) < CAR.radius + PED.radius) {
          ped.down = true;
          state.stats.pedsHit += 1;
          crime(WANTED.hitPed);
          floatText(ped.x, ped.y - 24, 'PEDESTRIAN DOWN +★');
          spark(ped.x, ped.y, '#ff5a4e', 8);
          audio.crash();
        }
      }
    }

    // --- wanted level and the police it calls
    let policeNear = false;
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      if (Math.hypot(car.x - player.x, car.y - player.y) < 500) policeNear = true;
    }
    const wantPolice = stepWanted(state.wanted, dt, policeNear);
    state.policeTimer -= dt;
    const police = state.cars.filter((c) => c.kind === 'police');
    if (police.length < wantPolice && state.policeTimer <= 0) {
      state.cars.push(spawnPolice(state.city, rng, player.x, player.y));
      state.policeTimer = 1.2;
    }
    if (wantPolice === 0 && police.length > 0) {
      state.cars = state.cars.filter((c) => c.kind !== 'police');
      floatText(player.x, player.y - 40, 'You lost them.');
    }
    // Police chase and ram; contact wears the player's health down, once per
    // step no matter how many cars are touching.
    let touchingPolice = false;
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      if (stepPoliceCar(car, player.x, player.y, state.city, dt)) touchingPolice = true;
    }
    if (touchingPolice && player.invulnerable <= 0) {
      player.health -= WANTED.policeContactDamage * dt;
      events |= EVENT_HIT;
    }

    // --- thugs (mission 4): they shoot when the player is in sight
    for (const thug of state.thugs) {
      const d = Math.hypot(player.x - thug.x, player.y - thug.y);
      thug.angle = Math.atan2(player.y - thug.y, player.x - thug.x);
      if (thug.fireCd > 0) thug.fireCd -= dt;
      if (d < THUG.sight && thug.fireCd <= 0 && player.invulnerable <= 0) {
        thug.fireCd = THUG.fireInterval;
        fireBullet(thug.x, thug.y, thug.angle, 'thug');
        audio.thugShoot();
      }
    }

    // --- bullets
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      if (!dead && insideBuilding(state.city, b.x, b.y)) {
        spark(b.x, b.y, '#8b93a3', 3);
        dead = true;
      }
      if (!dead && b.from === 'player') {
        for (let t = state.thugs.length - 1; t >= 0; t -= 1) {
          const thug = state.thugs[t];
          if (Math.hypot(b.x - thug.x, b.y - thug.y) < THUG.radius + BULLET.radius) {
            thug.health -= PLAYER.bulletDamage;
            spark(b.x, b.y, '#ff5a4e', 6);
            audio.hit();
            dead = true;
            if (thug.health <= 0) {
              spark(thug.x, thug.y, '#ff5a4e', 18);
              state.thugs.splice(t, 1);
              floatText(thug.x, thug.y - 24, 'Rival down');
            }
            break;
          }
        }
      }
      if (!dead && b.from === 'thug') {
        if (Math.hypot(b.x - player.x, b.y - player.y) < PLAYER.radius + BULLET.radius) {
          player.health -= THUG.damage;
          player.invulnerable = PLAYER.invulnerable;
          spark(b.x, b.y, '#ff5a4e', 6);
          audio.hit();
          events |= EVENT_HIT;
          dead = true;
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }

    // --- missions
    const def = MISSIONS[state.mission.index];
    if (def) {
      state.mission.elapsed += dt;
      if (def.thugs && !state.mission.thugsSpawned && markerDistance(state) < THUG_SPAWN_RADIUS) {
        spawnThugs();
      }
      let done = false;
      const dist = markerDistance(state);
      if (state.mission.index === 0) done = !player.onFoot;
      else if (state.mission.index === 2) done = state.wanted.level === 0 && dist < MARKER_RADIUS;
      else if (state.mission.index === 3) done = state.mission.thugsSpawned && state.thugs.length === 0 && dist < MARKER_RADIUS;
      else done = dist < MARKER_RADIUS;
      if (done) events |= completeMission(audio);
    }

    // --- busted?
    if (player.health <= 0 && !state.over) {
      player.health = 0;
      state.over = true;
      state.overReason = 'busted';
      events |= EVENT_OVER;
    }

    // --- camera follows the player, clamped to the city
    state.camera.x = Math.max(VIEW.width / 2, Math.min(CITY.width - VIEW.width / 2, player.x));
    state.camera.y = Math.max(VIEW.height / 2, Math.min(CITY.height - VIEW.height / 2, player.y));

    stepParticles(dt);
    return events;
  }

  function stepParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.texts.length - 1; i >= 0; i -= 1) {
      const t = state.texts[i];
      t.y -= 22 * dt;
      t.life -= dt;
      if (t.life <= 0) state.texts.splice(i, 1);
    }
  }

  return engine;
}
