// Neon Harbor — Meridian Bay. Bootstrap, game loop, state machine and
// the ?shot= scene setups used for screenshots. Everything is wired
// here; the systems live in their own modules.
import { CONFIG } from "./config.js";
import { makeRng } from "./rng.js";
import { buildWorld } from "./world.js";
import { createInput, isDown, wasPressed, endFrame } from "./input.js";
import { createAudio, unlockAudio, updateAudio } from "./audio.js";
import { createPlayer, updatePlayer } from "./player.js";
import { spawnCityCars, updateCars } from "./vehicles.js";
import { updatePolice } from "./police.js";
import { spawnPeds, updatePeds } from "./pedestrians.js";
import {
  createMissions,
  startMission,
  updateMissions,
  retryMission,
  loadBest,
  saveBest,
} from "./missions.js";
import { updateCamera, createCamera, render } from "./render.js";
import {
  drawHud,
  drawStartScreen,
  drawDeadScreen,
  drawCompleteScreen,
  drawPausedScreen,
} from "./hud.js";
import { addMessage } from "./police.js";

function readParams() {
  const params = new URLSearchParams(window.location.search);
  const seedRaw = parseInt(params.get("seed") || "", 10);
  return {
    seed: Number.isFinite(seedRaw) ? seedRaw : CONFIG.defaultSeed,
    shot: params.get("shot") || "",
  };
}

function createState(canvas) {
  const params = readParams();
  const rng = makeRng(params.seed);
  const world = buildWorld(rng);
  const spawn = { x: world.roads[1], y: world.roads[1] };
  const state = {
    canvas,
    ctx: canvas.getContext("2d"),
    rng,
    world,
    seed: params.seed,
    shot: params.shot,
    state: "menu",
    time: 0,
    spawn,
    player: createPlayer(spawn.x, spawn.y),
    playerCar: null,
    cars: [],
    peds: [],
    cops: [],
    wanted: 0,
    unseenTimer: 0,
    missions: createMissions(world),
    camera: createCamera(),
    input: createInput(canvas),
    audio: createAudio(),
    messages: [],
    effects: [],
    deathReason: "",
    stats: {
      carsStolen: 0,
      shotsFired: 0,
      missionsDone: 0,
      busted: 0,
      failedMissions: 0,
      bestCash: loadBest(),
    },
  };
  state.camera.x = spawn.x;
  state.camera.y = spawn.y;
  spawnCityCars(state);
  spawnPeds(state);
  return state;
}

function startGame(state) {
  state.state = "play";
  state.player.hp = CONFIG.playerHealth;
  state.player.cash = CONFIG.startCash;
  state.wanted = 0;
  state.cops = [];
  if (!state.missions.active && !state.missions.done) {
    startMission(state, 0);
  }
  addMessage(state, "Welcome to Meridian Bay. Follow the gold marker.");
}

// ---- Screenshot scenes (?shot=...) ----
// Each scene is a real render of the running game, set up
// deterministically from the seed so a screenshot replays the same.

function applyShot(state) {
  const shot = state.shot;
  if (!shot) return;
  if (shot === "start") {
    state.state = "menu";
    state.camera.x = state.world.size / 2;
    state.camera.y = state.world.size / 2;
    return;
  }
  if (shot === "play") {
    startGame(state);
    state.messages = [];
    state.shotDrive = true;
    putPlayerInCar(state, 2, 2, 0);
    return;
  }
  if (shot === "chase") {
    startGame(state);
    // Clear mission 1's intro lines so the chase feed is clean.
    state.messages = [];
    state.missions.index = 1;
    state.missions.step = 1;
    state.missions.active = true;
    state.missions.timer = 0;
    state.shotDrive = true;
    putPlayerInCar(state, 5, 5, 0);
    state.wanted = 3;
    addMessage(state, "WANTED — 3 stars! Lose the Meridian Bay police!");
    spawnChaseCops(state);
    return;
  }
  if (shot === "end") {
    startGame(state);
    state.player.cash = 4820;
    state.stats.missionsDone = 5;
    state.stats.carsStolen = 4;
    state.stats.shotsFired = 12;
    state.missions.done = true;
    state.missions.active = false;
    state.state = "complete";
    state.stats.bestCash = Math.max(state.stats.bestCash, state.player.cash);
    return;
  }
}

// Put the player in a fresh car on a road intersection near the
// given road indices, with traffic around for the shot.
function putPlayerInCar(state, roadX, roadY, angle) {
  const x = state.world.roads[roadX];
  const y = state.world.roads[roadY];
  const car = {
    id: 9000 + roadX * 10 + roadY,
    x,
    y,
    angle,
    speed: 260,
    color: "#2a9d8f",
    kind: "sedan",
    traffic: false,
    parked: false,
    driver: true,
    wrecked: false,
    hp: 100,
    ai: null,
    skid: 0,
  };
  state.cars.push(car);
  state.playerCar = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  state.camera.x = x;
  state.camera.y = y;
  // Clear a corridor ahead on this road so the demo drive never
  // wedges into a parked car or a traffic jam: move any car in the
  // way to another road. The street stays busy everywhere else.
  for (const other of state.cars) {
    if (other === car) continue;
    if (Math.abs(other.y - y) < 45 && other.x > x - 100 && other.x < x + 800) {
      const roads = state.world.roads.filter((r) => Math.abs(r - y) > 100);
      const newRoad = roads[Math.floor(state.rng() * roads.length)];
      const side = state.rng() < 0.5 ? 26 : -26;
      other.y = newRoad + side;
      other.x = Math.max(200, Math.min(state.world.size - 200, other.x + 400));
      if (other.traffic) {
        other.ai = { vertical: false, road: newRoad, dir: 1, speed: 150 };
        other.angle = 0;
      } else {
        other.angle = state.rng() < 0.5 ? 0 : Math.PI;
      }
    }
  }
  // Screenshot scenes keep the throttle open so the car cruises.
  state.shotDrive = state.shotDrive || false;
  // A few traffic cars right behind for a busy street.
  for (let i = 1; i <= 3; i++) {
    state.cars.push({
      id: 9100 + i,
      x: x - 140 * i,
      y: y + 14,
      angle: 0,
      speed: 150,
      color: ["#e63946", "#f4a261", "#4361ee"][i - 1],
      kind: "sedan",
      traffic: true,
      parked: false,
      driver: true,
      wrecked: false,
      hp: 100,
      ai: { vertical: false, road: y, dir: 1, speed: 150 },
      skid: 0,
    });
  }
}

function spawnChaseCops(state) {
  const p = state.player;
  const spots = [
    { x: p.x - 320, y: p.y - 60 },
    { x: p.x - 260, y: p.y + 90 },
    { x: p.x + 300, y: p.y + 40 },
  ];
  for (const spot of spots) {
    state.cops.push({
      id: 9200 + Math.floor(spot.x),
      x: spot.x,
      y: spot.y,
      angle: Math.atan2(p.y - spot.y, p.x - spot.x),
      speed: 420,
      color: "#1d3557",
      kind: "cop",
      hp: 120,
      wrecked: false,
      traffic: false,
      parked: false,
      driver: true,
      bustedTimer: 0,
    });
  }
}

// ---- Update ----

function update(state, dt) {
  state.time += dt;
  for (const msg of state.messages) msg.t -= dt;
  state.messages = state.messages.filter((m) => m.t > 0);
  for (const e of state.effects) e.life -= dt;
  state.effects = state.effects.filter((e) => e.life > 0);

  // Audio unlocks on the first gesture, never before.
  if (state.input.anyKey || state.input.mousePressed) unlockAudio(state.audio);
  if (wasPressed(state.input, "m")) {
    state.audio.muted = !state.audio.muted;
    addMessage(state, state.audio.muted ? "Sound muted." : "Sound on.");
  }

  if (state.state === "menu") {
    if (wasPressed(state.input, "Enter")) startGame(state);
    updateAmbient(state, dt);
    updateCamera(state, dt);
    return;
  }

  if (state.state === "dead") {
    if (wasPressed(state.input, "r")) respawn(state);
    updateAmbient(state, dt);
    return;
  }

  if (state.state === "complete") {
    if (wasPressed(state.input, "r")) restart(state);
    updateAmbient(state, dt);
    updateCamera(state, dt);
    return;
  }

  if (state.state === "paused") {
    if (wasPressed(state.input, "p") || wasPressed(state.input, "Escape")) {
      state.state = "play";
    }
    return;
  }

  // Playing.
  if (wasPressed(state.input, "p") || wasPressed(state.input, "Escape")) {
    state.state = "paused";
    return;
  }
  if (wasPressed(state.input, "r") && state.missions.failed) {
    retryMission(state);
  }

  updatePlayer(state, dt);
  updateCars(state, dt);
  updatePolice(state, dt);
  updatePeds(state, dt);
  updateMissions(state, dt);
  updateCamera(state, dt);
  updateAudio(state.audio, dt, state);

  // Death by damage.
  if (state.player.hp <= 0) {
    state.state = "dead";
    state.player.hp = 0;
    const penalty = Math.floor(state.player.cash * CONFIG.respawnCashPenalty);
    state.player.cash -= penalty;
    state.wanted = 0;
    state.cops = [];
    state.playerCar = null;
    addMessage(state, "WASTED — the hospital kept $" + penalty + " of your cash.");
    saveBest(state);
  }
}

// Traffic and pedestrians keep moving behind menus so the city
// never looks frozen in a screenshot.
function updateAmbient(state, dt) {
  for (const car of state.cars) {
    if (car.traffic && car.ai && !car.wrecked) {
      car.x += Math.cos(car.angle) * car.ai.speed * dt;
      car.y += Math.sin(car.angle) * car.ai.speed * dt;
      if (car.x < 60) car.x = state.world.size - 60;
      if (car.x > state.world.size - 60) car.x = 60;
      if (car.y < 60) car.y = state.world.size - 60;
      if (car.y > state.world.size - 60) car.y = 60;
    }
  }
  updatePeds(state, dt);
}

function respawn(state) {
  state.player.hp = CONFIG.playerHealth;
  state.player.x = state.spawn.x;
  state.player.y = state.spawn.y;
  state.player.angle = -Math.PI / 2;
  state.camera.x = state.spawn.x;
  state.camera.y = state.spawn.y;
  state.state = "play";
  addMessage(state, "Back on your feet. The bay is still waiting.");
}

function restart(state) {
  const keepBest = Math.max(state.stats.bestCash, state.player.cash);
  const fresh = createState(state.canvas);
  fresh.stats.bestCash = keepBest;
  Object.assign(state, fresh);
  startGame(state);
}

// ---- Boot ----

function resize(canvas) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function main() {
  const canvas = document.getElementById("game");
  if (!canvas || !canvas.getContext) return;
  resize(canvas);
  window.addEventListener("resize", () => resize(canvas));

  const state = createState(canvas);
  window.__neonHarbor = state;
  applyShot(state);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    update(state, dt);
    render(state);
    if (state.state === "menu") drawStartScreen(state.ctx, state);
    else if (state.state === "dead") drawDeadScreen(state.ctx, state);
    else if (state.state === "complete") drawCompleteScreen(state.ctx, state);
    else if (state.state === "paused") drawPausedScreen(state.ctx, state);
    else drawHud(state.ctx, state);
    endFrame(state.input);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
