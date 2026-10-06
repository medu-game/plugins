// The two families the compositions render in, loaded once.
//
// loadFont() with no arguments asks Google Fonts for every variant a family
// publishes: both styles, nine weights, four subsets. Across these two that is
// 189 requests inside Remotion's 28 second delayRender budget, nearly all of
// them for variants no frame ever uses. One slow network and the render times
// out on fonts rather than on anything real.
//
// The list below is what the compositions actually set, plus 400 because that
// is what unstyled text renders at, and normal only because nothing is
// italic. Setting a fontWeight this list does not carry falls back to a system
// font silently: the render still succeeds and the frame looks wrong. So when
// changing a weight, look at a frame, not at the exit code.
//
// Loading lives here rather than in each composition so the two cannot drift
// into asking for different variant sets.
import { loadFont as loadDisplay } from '@remotion/google-fonts/HankenGrotesk';
import { loadFont as loadBody } from '@remotion/google-fonts/Inter';

const WEIGHTS = ['400', '500', '700', '800'] as const;
// latin-ext carries the accented characters Dutch narration can reach.
const SUBSETS = ['latin', 'latin-ext'] as const;

export const { fontFamily: DISPLAY } = loadDisplay('normal', {
  weights: [...WEIGHTS],
  subsets: [...SUBSETS],
});

export const { fontFamily: BODY } = loadBody('normal', {
  weights: [...WEIGHTS],
  subsets: [...SUBSETS],
});
