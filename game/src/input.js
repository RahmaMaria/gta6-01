// Keyboard and mouse input for Neon Harbor. Tracks held keys, edge
// presses (a key that went down this frame), and the mouse position
// in canvas pixels. The game loop consumes edges once per frame.
export function createInput(canvas) {
  const input = {
    keys: Object.create(null),
    pressed: Object.create(null),
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mousePressed: false,
    anyKey: false,
  };

  function onKeyDown(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!input.keys[key]) input.pressed[key] = true;
    input.keys[key] = true;
    input.anyKey = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    input.keys[key] = false;
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    onMouseMove(event);
    input.mouseDown = true;
    input.mousePressed = true;
    input.anyKey = true;
  }

  function onMouseUp() {
    input.mouseDown = false;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  return input;
}

// True while the key is held down.
export function isDown(input, key) {
  return !!input.keys[key];
}

// True only on the frame the key went down.
export function wasPressed(input, key) {
  return !!input.pressed[key];
}

// True when the left mouse button went down this frame.
export function isClicked(input) {
  return input.mousePressed;
}

// True when any of the given keys is held.
export function anyDown(input, keys) {
  for (const key of keys) if (input.keys[key]) return true;
  return false;
}

// Clear the per-frame edge state. Call once at the end of each update.
export function endFrame(input) {
  input.pressed = Object.create(null);
  input.mousePressed = false;
  input.anyKey = false;
}
