// FlowKeeper brand tokens, transcribed from colors_and_type.css in the Claude
// Design project (64ad52a8-e2c8-4076-bd56-9970a8129927). That file is the
// source of truth; this is the subset the video needs.
//
// Deliberately NOT ported: --gray-500 (#94000C), which the stylesheet itself
// flags as a documentation typo. It is a dark red, not a grey.

export const BRAND = {
  // Primary
  blue500: '#5938ED', // buttons, links, toggles
  blue600: '#2F06E9', // wordmark, hover accent
  blue800: '#180374',
  blue900: '#0C023A',

  // Logo accent, the "flow" arrows
  green: '#3AF39F',
  green600: '#09F087',
  // Measured from Tim's intro design (flowkeeper_intro.png), where the rule
  // under the lockup is lighter than the logo accent. Not yet reconciled
  // against colors_and_type.css, so it carries no name from there.
  green300: '#7AF0A6',

  // Ink and surfaces
  ink: '#141317',
  ink800: '#25262D',
  muted: '#646071',
  surface: '#FFFFFF',
  appBg: '#F7F7F8',
  border: '#E5E7EA',

  // Taken from the interstitials source in Tims "Tussenschermen animatie"
  // bundle, which is the authority for those screens. Same caveat as green300:
  // measured from what he made, not yet reconciled against colors_and_type.css.
  paper: '#FAFAFA', // the light cards ground
  gray50: '#F4F4F5', // the task column panel
  gray300: '#D4D4D8', // inactive nodes and rules
  cardBorder: '#E4E4E7', // hairlines on the cards
  fg2: '#52525B', // card subtitle on light
  fg3: '#6B6B75', // card label on light
  lavender: '#C7C0F7', // card subtitle on indigo
} as const;

// The brand backdrop behind the intro and outro cards.
export const BRAND_BACKDROP =
  'radial-gradient(120% 120% at 28% 18%, #1B0A6B 0%, #120341 52%, #0A0228 100%)';
export const BRAND_GLOW =
  'radial-gradient(40% 50% at 82% 88%, rgba(58,243,159,0.18) 0%, rgba(58,243,159,0) 70%)';

// The light studio backdrop the app window floats on.
export const STUDIO_BACKDROP =
  'radial-gradient(120% 120% at 30% 8%, #EEF0F8 0%, #E4E6F0 55%, #DADCEA 100%)';

// Where the recorded app window sits on the 1920x1080 stage. These are the
// dimensions of the VIDEO AREA, not of the whole window: the fake browser bar
// is added above this, so the chrome does not eat into the picture.
//
// 16:9 exactly, so the capture is never stretched: 1680/945 === 1920/1080. That
// invariant was silently broken for a while. The chrome bar used to be
// subtracted from this height, which left the video area at 1680x901, no longer
// 16:9, so the browser letterboxed it: 39px of backdrop down each side and a
// scale of 0.8343 instead of 0.875. The cursor layer kept using PAGE_SCALE, so
// the drawn pointer sat 54px to the right of the button it was pressing.
export const WINDOW = { x: 120, y: 68, width: 1680, height: 945 } as const;

// Page pixels to stage pixels. Everything derived from a browser coordinate
// (cursor positions, focus boxes) must go through this, or the cursor drifts
// off the button it is supposed to be clicking.
export const PAGE_SCALE = WINDOW.width / 1920;

export function pageToStageX(px: number): number {
  return WINDOW.x + px * PAGE_SCALE;
}

export function pageToStageY(py: number): number {
  return WINDOW.y + py * PAGE_SCALE;
}
