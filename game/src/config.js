// config.js: Color palette, canvas dimensions, and gameplay tuning constants.

export const CONFIG = {
  width: 1280,
  height: 720,
  colors: {
    bg: '#080312',
    cyan: '#00f0ff',
    magenta: '#ff007f',
    violet: '#9d00ff',
    orange: '#ff7700',
    yellow: '#ffee00',
    white: '#ffffff',
    darkViolet: '#1a0d2e',
    gridLine: 'rgba(0, 240, 255, 0.15)',
    sunOrange: '#ff4400',
    sunYellow: '#ffea00',
  },
  player: {
    speed: 7,
    fireRate: 6, // shots per second
    invulnTime: 2.0, // seconds
    maxLives: 3,
  },
  scoring: {
    drifter: 100,
    weaver: 150,
    tank: 300,
    boss: 2500,
    lantern: 500,
  }
};
