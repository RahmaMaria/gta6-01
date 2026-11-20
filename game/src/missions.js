// The five-mission story of Mara Voss, a courier driver who owes the
// wrong people money and works it off one job at a time across
// Meridian Bay. Each mission is a chain of targets; finishing one
// pays cash and opens the next. Finish all five and the story ends.
import { CONFIG } from "./config.js";
import { districtAt } from "./world.js";
import { addMessage, addWanted } from "./police.js";
import { playPayout, playBlip } from "./audio.js";
import { spawnTargetCar } from "./vehicles.js";

// Centre of the district cell that holds a named district, snapped
// to the nearest road intersection so targets sit on drivable roads.
export function districtTarget(world, name) {
  let col = 0;
  let row = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (world.districtGrid[r][c] === name) {
        row = r;
        col = c;
      }
    }
  }
  const cx = (col + 0.5) * (world.size / 3);
  const cy = (row + 0.5) * (world.size / 3);
  let bestX = world.roads[0];
  let bestY = world.roads[0];
  for (const r of world.roads) {
    if (Math.abs(r - cx) < Math.abs(bestX - cx)) bestX = r;
    if (Math.abs(r - cy) < Math.abs(bestY - cy)) bestY = r;
  }
  return { x: bestX, y: bestY };
}

function missionDefs(world) {
  return [
    {
      id: 1,
      title: "First Delivery",
      client: "Sal the Dispatcher",
      briefing: "Sal needs a package in Gull Market before the lunch rush. Drive it over — no questions, no stops.",
      steps: [
        { text: "Deliver the package to Gull Market", target: districtTarget(world, "Gull Market"), reward: 350 },
      ],
    },
    {
      id: 2,
      title: "Hot Wheels",
      client: "Rook",
      briefing: "Rook wants the coral sportscar parked in Vela Point. Take it — quietly — and bring it to the Anchor Quarter garage.",
      steps: [
        { text: "Steal the coral sportscar in Vela Point", target: districtTarget(world, "Vela Point"), needCar: true, reward: 0 },
        { text: "Deliver the sportscar to the Anchor Quarter garage", target: districtTarget(world, "Anchor Quarter"), reward: 600 },
      ],
    },
    {
      id: 3,
      title: "The Collector",
      client: "Madame Okafor",
      briefing: "Three shopkeepers owe Madame Okafor. Collect from each — the Meridian Bay patrol is already watching, so expect one star of heat.",
      steps: [
        { text: "Collect from the Gull Market stall", target: districtTarget(world, "Gull Market"), reward: 150 },
        { text: "Collect from the Coral Row kiosk", target: districtTarget(world, "Coral Row"), reward: 150 },
        { text: "Collect from the Saltworks depot", target: districtTarget(world, "Saltworks"), reward: 300 },
      ],
    },
    {
      id: 4,
      title: "Dockside Run",
      client: "Sal the Dispatcher",
      briefing: "A crate at the Meridian Docks leaves on the tide in 90 seconds. Two stars of heat are already on you — drive like the tide matters.",
      timer: 90,
      steps: [
        { text: "Reach the Meridian Docks before the tide", target: districtTarget(world, "Meridian Docks"), reward: 800 },
      ],
    },
    {
      id: 5,
      title: "The Harbor Job",
      client: "The Benefactor",
      briefing: "One last job and the debt is gone: lift the vault cash on Beacon Hill, then lose four stars of heat and reach the Palma Heights safehouse.",
      steps: [
        { text: "Grab the vault cash on Beacon Hill", target: districtTarget(world, "Beacon Hill"), reward: 1200 },
        { text: "Escape to the Palma Heights safehouse", target: districtTarget(world, "Palma Heights"), needLowHeat: true, reward: 1500 },
      ],
    },
  ];
}

export function createMissions(world) {
  return {
    defs: missionDefs(world),
    index: 0,
    step: 0,
    timer: 0,
    active: false,
    targetCar: null,
    done: false,
    failed: false,
  };
}

export function currentMission(state) {
  const m = state.missions;
  if (m.done || m.index >= m.defs.length) return null;
  return m.defs[m.index];
}

export function currentStep(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  return mission.steps[state.missions.step];
}

export function startMission(state, index) {
  const m = state.missions;
  m.index = index;
  m.step = 0;
  m.active = true;
  m.failed = false;
  const mission = m.defs[index];
  m.timer = mission.timer || 0;
  addMessage(state, "MISSION " + mission.id + ": " + mission.title + " — " + mission.client);
  addMessage(state, mission.briefing);
  if (mission.id === 2) {
    const spot = districtTarget(state.world, "Vela Point");
    m.targetCar = spawnTargetCar(state, spot.x + 26, spot.y);
  }
  if (mission.id === 3) addWanted(state, 1, "The patrol is watching the collectors.");
  if (mission.id === 4) addWanted(state, 2, "Dockside patrol is already on you!");
  if (mission.id === 5) addWanted(state, 2, "Beacon Hill alarms are live.");
  playBlip(state.audio, 880);
}

export function updateMissions(state, dt) {
  const m = state.missions;
  if (!m.active || m.done) return;
  const mission = currentMission(state);
  if (!mission) return;
  const step = currentStep(state);
  if (!step) return;

  // Timed missions fail when the clock runs out.
  if (mission.timer) {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.failed = true;
      m.active = false;
      addMessage(state, "MISSION FAILED: the tide took the crate. Press R to retry the mission.");
      state.stats.failedMissions++;
      return;
    }
  }

  const p = state.player;
  const target = step.target;
  const dist = Math.hypot(p.x - target.x, p.y - target.y);

  // Step 1 of mission 2 completes when Mara is driving the target car.
  if (step.needCar) {
    if (state.playerCar && state.playerCar === m.targetCar) {
      completeStep(state, mission, step);
    }
    return;
  }

  if (dist < CONFIG.missionMarkerRadius + 30) {
    if (step.needLowHeat && state.wanted > 0) {
      addMessage(state, "Too hot — lose the wanted stars before the safehouse opens.");
      return;
    }
    completeStep(state, mission, step);
  }
}

function completeStep(state, mission, step) {
  const m = state.missions;
  if (step.reward > 0) {
    state.player.cash += step.reward;
    addMessage(state, "+$" + step.reward + " — " + step.text);
    playPayout(state.audio);
  } else {
    addMessage(state, step.text + " — done.");
    playBlip(state.audio, 990);
  }
  m.step++;
  if (m.step >= mission.steps.length) {
    state.stats.missionsDone++;
    addMessage(state, "MISSION COMPLETE: " + mission.title + "!");
    if (m.index + 1 >= m.defs.length) {
      m.done = true;
      m.active = false;
      state.state = "complete";
      state.stats.bestCash = Math.max(state.stats.bestCash, state.player.cash);
      saveBest(state);
    } else {
      startMission(state, m.index + 1);
    }
  }
}

// Retry the current mission after a failure.
export function retryMission(state) {
  const m = state.missions;
  if (m.failed) {
    startMission(state, m.index);
  }
}

// Best cash persists in localStorage; guarded for headless runs.
export function saveBest(state) {
  try {
    const best = Math.max(state.stats.bestCash, state.player.cash);
    localStorage.setItem("neon-harbor-best-cash", String(best));
  } catch (err) {
    // Storage may be unavailable; the game still plays.
  }
}

export function loadBest() {
  try {
    const raw = localStorage.getItem("neon-harbor-best-cash");
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch (err) {
    return 0;
  }
}

// Short objective line for the HUD.
export function objectiveText(state) {
  const mission = currentMission(state);
  if (!mission) return "All missions complete — Meridian Bay is yours.";
  const step = currentStep(state);
  if (!step) return mission.title;
  let text = "M" + mission.id + " " + mission.title + ": " + step.text;
  if (step.needLowHeat && state.wanted > 0) {
    text += " — LOSE THE HEAT FIRST";
  }
  if (state.missions.timer > 0 && mission.timer) {
    text += "  (" + Math.ceil(state.missions.timer) + "s)";
  }
  return text;
}

// Distance in metres (world units / 10) to the current target.
export function targetDistance(state) {
  const step = currentStep(state);
  if (!step) return 0;
  const p = state.player;
  return Math.round(Math.hypot(p.x - step.target.x, p.y - step.target.y) / 10);
}
