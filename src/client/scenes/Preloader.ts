import { Scene } from 'phaser';

/** Generates the few procedural textures the game needs, then enters the menu. */
export class Preloader extends Scene {
  constructor() {
    super('Preloader');
  }

  create() {
    this.makeSpark();
    this.makeDot();
    this.scene.start('MainMenu');
  }

  /** Soft round particle for ink splashes / celebration. */
  private makeSpark() {
    const size = 32;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(size / 2, size / 2, size / 2);
    g.generateTexture('spark', size, size);
    g.destroy();
  }

  /** Small dot used for the ball's motion trail. */
  private makeDot() {
    const size = 16;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(size / 2, size / 2, size / 2);
    g.generateTexture('dot', size, size);
    g.destroy();
  }
}
