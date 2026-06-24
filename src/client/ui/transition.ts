import * as Phaser from 'phaser';

const R = 244;
const G = 236;
const B = 216; // paper colour, so fades read as paper, not black

/** Gentle fade-in; call at the top of a scene's create(). */
export function fadeIn(scene: Phaser.Scene, ms = 220): void {
  scene.cameras.main.fadeIn(ms, R, G, B);
}

/** Fade out, then start another scene (smooth nav between screens). */
export function fadeToScene(
  scene: Phaser.Scene,
  key: string,
  data?: object,
  ms = 200
): void {
  const cam = scene.cameras.main;
  cam.fadeOut(ms, R, G, B);
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key, data));
}
