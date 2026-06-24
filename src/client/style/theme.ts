/**
 * INKDROP visual identity  cozy hand-drawn ink on warm paper.
 * One accent (vermillion inkwell), restrained palette, no stock gradients.
 */

export const COLORS = {
  paper: 0xf4ecd8,
  paperEdge: 0xe7dcc0,
  paperShadow: 0x000000,
  ink: 0x2b2b3a,
  inkSoft: 0x55556a,
  inkFaint: 0x8a8aa0,
  accent: 0xe2574c, // vermillion  inkwell / goal
  accentDark: 0xbf4339,
  blue: 0x3b82c4,
  gold: 0xe7a93a, // streak flame / stars
  green: 0x4f9d69, // success
  ghost: 0x6b6b85,
};

/** Same palette as CSS hex strings (for Phaser text + DOM). */
export const HEX = {
  paper: '#f4ecd8',
  paperEdge: '#e7dcc0',
  ink: '#2b2b3a',
  inkSoft: '#55556a',
  inkFaint: '#8a8aa0',
  accent: '#e2574c',
  accentDark: '#bf4339',
  blue: '#3b82c4',
  gold: '#e7a93a',
  green: '#4f9d69',
  white: '#fbf7ec',
};

// Original hues, kept so colorblind mode can be toggled back off.
const BASE = {
  accent: COLORS.accent,
  accentDark: COLORS.accentDark,
  green: COLORS.green,
  hexAccent: HEX.accent,
  hexAccentDark: HEX.accentDark,
  hexGreen: HEX.green,
};

/**
 * Swap to a colorblind-safe palette (Okabe-Ito): vermillion → orange, green → a
 * blue-leaning teal, so goal vs ink vs success stay distinguishable for the most
 * common (red-green) color vision deficiencies. Mutates the shared palette so all
 * subsequently drawn elements pick it up.
 */
export function applyColorblind(on: boolean): void {
  if (on) {
    COLORS.accent = 0xe69f00;
    COLORS.accentDark = 0xb87e00;
    COLORS.green = 0x0072b2;
    HEX.accent = '#e69f00';
    HEX.accentDark = '#b87e00';
    HEX.green = '#0072b2';
  } else {
    COLORS.accent = BASE.accent;
    COLORS.accentDark = BASE.accentDark;
    COLORS.green = BASE.green;
    HEX.accent = BASE.hexAccent;
    HEX.accentDark = BASE.hexAccentDark;
    HEX.green = BASE.hexGreen;
  }
}

export const FONTS = {
  /** Literary heading face  falls back gracefully across platforms. */
  display: '"Caveat", "Bradley Hand", "Segoe Print", "Comic Sans MS", cursive',
  /** Clean UI sans. */
  ui: '"Nunito", "Segoe UI", system-ui, -apple-system, sans-serif',
};

/** Standard heading text style. */
export function titleStyle(size: number): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONTS.display,
    fontSize: `${size}px`,
    color: HEX.ink,
  };
}

/** Standard body/UI text style. */
export function uiStyle(
  size: number,
  color: string = HEX.ink
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONTS.ui,
    fontSize: `${size}px`,
    color,
    fontStyle: '600',
  };
}
