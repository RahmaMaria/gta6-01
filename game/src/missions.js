// The story: five jobs for Rook's crew, from a kid with no wheels to the run
// that owns Meridian Bay. Each mission names its marker on the map, its
// dialogue, and what sets it off. The engine checks the conditions; this file
// only holds the writing and the numbers. All names are invented.

import { MISSION_REWARDS } from './config.js';

export const MISSIONS = [
  {
    title: 'First Wheels',
    objective: 'Get in a car — any car. Press E beside one.',
    lines: [
      'Vic: "Kid, you want work? First you need wheels."',
      'Vic: "The pink one by the garage is unlocked. Don\'t ask."',
    ],
    marker: 'garage',
    reward: MISSION_REWARDS[0],
  },
  {
    title: 'The Pickup',
    objective: 'Drive to Pier 9 and pick up the package.',
    lines: [
      'Rook: "Package is waiting at Pier 9, south docks."',
      'Rook: "Drive normal. Cops love a kid in a hurry."',
    ],
    marker: 'docks',
    reward: MISSION_REWARDS[1],
  },
  {
    title: 'Getaway',
    objective: 'Lose the cops, then reach the safehouse.',
    lines: [
      'Rook: "Somebody talked. The whole precinct is coming."',
      'Rook: "Shake them and get to the safehouse. No heroics."',
    ],
    marker: 'safehouse',
    reward: MISSION_REWARDS[2],
    wantedOnStart: 2,
  },
  {
    title: 'The Exchange',
    objective: 'Deal with the rivals at the Exchange, then make the drop.',
    lines: [
      'Vic: "Rook\'s rivals are camped at the Exchange."',
      'Vic: "On foot, pistol out. The car can\'t do this one."',
    ],
    marker: 'exchange',
    reward: MISSION_REWARDS[3],
    thugs: 3,
  },
  {
    title: 'Harbor King',
    objective: 'Reach the yacht at the pier. Meridian Bay is waiting.',
    lines: [
      'Rook: "One last run. The yacht, the pier, the whole bay."',
      'Rook: "Bring it home, kid, and the city is yours."',
    ],
    marker: 'yacht',
    reward: MISSION_REWARDS[4],
    wantedOnStart: 3,
  },
];

/** The dialogue line showing now, or null when the mission's lines are spent. */
export function missionLine(mission, elapsed) {
  const def = MISSIONS[mission.index];
  if (!def) return null;
  const lineIndex = Math.floor(elapsed / 5);
  if (lineIndex >= def.lines.length) return null;
  return def.lines[lineIndex];
}

/** Distance from the player to the current mission's marker. */
export function markerDistance(state) {
  const def = MISSIONS[state.mission.index];
  if (!def || !def.marker) return Infinity;
  const marker = state.city.markers[def.marker];
  return Math.hypot(state.player.x - marker.x, state.player.y - marker.y);
}
