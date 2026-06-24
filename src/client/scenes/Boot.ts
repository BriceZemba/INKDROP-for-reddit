import { Scene } from 'phaser';

/**
 * Minimal boot  INKDROP draws everything with vector graphics, so there are no
 * heavy assets. We do wait for the bundled web fonts to finish loading before the
 * first scene paints, so the title/UI never flash a generic fallback face.
 */
export class Boot extends Scene {
  constructor() {
    super('Boot');
  }

  async create() {
    await this.ensureFonts();
    this.scene.start('Preloader');
  }

  /** Kick off + await the bundled fonts (capped, so a slow load never hangs boot). */
  private async ensureFonts(): Promise<void> {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts?.load) return;
    try {
      await Promise.race([
        Promise.all([
          fonts.load('700 64px "Caveat"'),
          fonts.load('800 24px "Nunito"'),
          fonts.load('600 24px "Nunito"'),
        ]),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    } catch {
      /* fall back to the system stack defined in theme FONTS */
    }
  }
}
