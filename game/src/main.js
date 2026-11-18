// Neon Harbor — boot and the one loop: input is read every frame, the engine
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast one),
// and the renderer paints what is there. The game moves between five screens:
// title, play, paused, busted and victory. A save on this browser resumes the
// mission and cash where the last run left off.
//
// ?seed=N fixes the city and the traffic. ?shot=start|play|chase|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createEngine, EVENT_HIT, EVENT_MISSION, EVENT_OVER, EVENT_WIN } from './engine.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import {
  SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN, createRenderer,
} from './render.js';
import { clearSave, loadBest, loadSave, writeBest, writeSave } from './save.js';
import { silentAudio, stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const saved = loadSave();
const engine = createEngine(seed, saved ? saved.mission : 0, saved ? saved.cash : 0);
const renderer = createRenderer(canvas);
const audio = createAudio();

function runShot(name) {
  const scene = stageShot(name, engine);
  // Keep floating labels out of the end panel.
  engine.state.texts.length = 0;
  let painted = 0;
  function paint() {
    renderer.draw(engine.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = loadBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function bankProgress() {
    const state = engine.state;
    if (state.player.cash > best) {
      best = state.player.cash;
      writeBest(best);
    }
    writeSave(state.mission.index, state.player.cash);
  }

  function startGame() {
    audio.unlock();
    audio.click();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Follow the gold marker — the job is waiting.');
  }

  function newRun() {
    clearSave();
    engine.reset();
    best = loadBest();
    startGame();
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    engine.state.texts.length = 0; // keep floating labels out of the end panel
    bankProgress();
    if (won) {
      audio.victory();
      clearSave();
      announce(`Harbor King. Cash $${engine.state.player.cash}. Best $${best}.`);
    } else {
      audio.gameOver();
      announce(`Busted. Cash $${engine.state.player.cash}. Best $${best}. Press R to run it back.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) startGame();
    else if (actions & ACTION_RESTART && (screen === SCREEN_OVER || screen === SCREEN_WIN)) newRun();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }

    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      // The mouse aims in world coordinates; the camera moves with the player.
      const mouse = input.mouse();
      const world = renderer.toWorld(mouse.x, mouse.y, engine.state);
      const aimAngle = Math.atan2(world.y - engine.state.player.y, world.x - engine.state.player.x);
      let firstStep = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        const drive = {
          move: input.move(),
          aimAngle,
          firing: input.firing,
          enterPressed: firstStep && (actions & ACTION_ENTER_CAR) !== 0,
        };
        firstStep = false;
        let events;
        if (screen === SCREEN_TITLE) {
          events = engine.step(STEP, drive, silentAudio, true);
        } else {
          events = engine.step(STEP, drive, audio, false);
        }
        accumulator -= STEP;
        if (events & EVENT_WIN) {
          endGame(true);
          break;
        }
        if (events & EVENT_OVER) {
          endGame(false);
          break;
        }
        if (events & EVENT_MISSION) {
          bankProgress();
          announce(`Job done. Cash $${engine.state.player.cash}.`);
        } else if (events & EVENT_HIT) {
          announce(`Hit. ${Math.ceil(engine.state.player.health)} health left.`);
        }
      }
    } else {
      accumulator = 0;
    }
    // The engine hum and the bass line follow the run, never the menus.
    if (screen === SCREEN_PLAY) {
      const player = engine.state.player;
      const speed = Math.hypot(player.vx, player.vy);
      audio.update(STEP, Math.min(1, speed / 560), engine.state.wanted.level);
    }
    renderer.draw(engine.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the cops close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  // First gesture unlocks the synthesised sound.
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });

  announce('Neon Harbor. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
