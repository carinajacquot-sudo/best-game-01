// input.js: Keyboard, mouse, and touch input handlers, tracking keys and actions.

export class InputHandler {
  constructor() {
    this.keys = new Map();
    this.pressed = new Map();
    this.mouse = { x: 640, y: 360, down: false };

    this._onKeyDown = (e) => {
      const code = e.code;
      if (!this.keys.get(code)) {
        this.pressed.set(code, true);
      }
      this.keys.set(code, true);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code)) {
        e.preventDefault();
      }
    };

    this._onKeyUp = (e) => {
      this.keys.set(e.code, false);
    };

    this._onMouseMove = (e) => {
      const rect = e.target.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 1280;
        this.mouse.y = ((e.clientY - rect.top) / rect.height) * 720;
      }
    };

    this._onMouseDown = (e) => {
      this.mouse.down = true;
    };

    this._onMouseUp = (e) => {
      this.mouse.down = false;
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  isDown(code) {
    return !!this.keys.get(code);
  }

  wasPressed(code) {
    const val = !!this.pressed.get(code);
    this.pressed.set(code, false);
    return val;
  }

  // Check movement axes
  getAxisX() {
    let x = 0;
    if (this.isDown('ArrowLeft') || this.isDown('KeyA')) x -= 1;
    if (this.isDown('ArrowRight') || this.isDown('KeyD')) x += 1;
    return x;
  }

  getAxisY() {
    let y = 0;
    if (this.isDown('ArrowUp') || this.isDown('KeyW')) y -= 1;
    if (this.isDown('ArrowDown') || this.isDown('KeyS')) y += 1;
    return y;
  }

  isFiring() {
    return this.isDown('Space') || this.isDown('KeyJ') || this.mouse.down;
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
  }
}
