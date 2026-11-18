// Save and load through localStorage: the mission reached, the cash earned
// and the best cash, so a player can continue a run on a later visit. Nothing
// leaves the browser.

import { BEST_KEY, SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      mission: Number.isInteger(data.mission) ? data.mission : 0,
      cash: Number.isFinite(data.cash) ? data.cash : 0,
    };
  } catch {
    return null;
  }
}

export function writeSave(mission, cash) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ mission, cash }));
  } catch {
    // Storage can be off (private windows): the run then lasts this visit only.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do: there was no save to clear.
  }
}

export function loadBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function writeBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best then lasts this visit only.
  }
}
