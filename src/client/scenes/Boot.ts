import { Scene } from 'phaser';

/** Minimal boot — INKDROP draws everything with vector graphics, so no heavy load. */
export class Boot extends Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.scene.start('Preloader');
  }
}
