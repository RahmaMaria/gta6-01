// Neon Harbor — Meridian Bay: entry program for make.fun gta6-01.
// Node 22, standard library only. Copies the playable game/ and the
// screenshots/ beside this file into the output directory, then writes
// /output/dossier.json with the vendored make.fun library so the
// scorer can verify the entry byte for byte. Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

// Count the files under a directory, recursively, for the build log.
function countFiles(dir) {
  let count = 0;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) count += countFiles(full);
    else count++;
  }
  return count;
}

function copyTree(from, to) {
  if (!existsSync(from)) return false;
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  return true;
}

function build() {
  mkdirSync(out, { recursive: true });
  // Start clean so a stale file can never leak into the entry.
  const gameOut = join(out, "game");
  const shotsOut = join(out, "screenshots");
  rmSync(gameOut, { recursive: true, force: true });
  rmSync(shotsOut, { recursive: true, force: true });

  const gameCopied = copyTree(join(here, "game"), gameOut);
  if (!gameCopied) throw new Error("game/ is missing next to main.ts");
  const shotsCopied = copyTree(join(here, "screenshots"), shotsOut);
  if (!shotsCopied) throw new Error("screenshots/ is missing next to main.ts");

  // The scorer's own caps (reference/gate.json): text_max_bytes shapes
  // the dossier bytes; the others refuse an entry the scorer would
  // refuse — more than 4 screenshots or one over 256 KiB; more than
  // 993 files in game/ or 48 MiB of game files in all, or a path
  // under game/ over 1000 bytes.
  const dossier = buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(out, "dossier.json"), dossier);
  console.log("Neon Harbor entry written to " + out);
  console.log("game files: " + countFiles(gameOut));
  console.log("dossier.json: " + dossier.length + " bytes");
}

build();
