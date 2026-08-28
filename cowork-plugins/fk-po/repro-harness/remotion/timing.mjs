// Timing constants in plain JS so the Node stages (narrate, render-help,
// captions) and the Remotion composition read the same numbers. A subtitle
// offset that silently disagrees with the intro length is invisible until a
// customer notices, so there is exactly one definition of it.
export const FPS = 30;
// The clip is 4.5s, but its logo fades out over the last 0.4s and the intro
// builds on the settled lockup instead of throwing it away. Measured on
// intro-light.mp4: full opacity from 3.4s, fade starts at 4.15s.
export const INTRO_CLIP_SEC = 4.1;
// The whole intro: the clip, the lockup moving up into the design's position,
// then the title and the one-line explanation, held long enough to read. Tim
// asked for longer on 2026-08-25: at 7.0s the text stood for about 1.5s, which
// is not enough for a title plus two lines. The subtitle file offsets every cue
// by this, so it must match or the captions drift.
export const INTRO_SEC = 8.5;
// The music spans the whole intro and fades as the voice-over starts, so its
// length follows INTRO_SEC. That is not the flat bed this had two revisions
// ago: the loud moment is cued to the logo landing and what carries on under
// the title screen is that cue's own tail. Tim's call on 2026-08-25, after
// hearing a 3s cue leave 5.5s of silence over the part where the title
// appears.
export const INTRO_MUSIC_SEC = INTRO_SEC;
// The outro is the intro clip trimmed at INTRO_CLIP_SEC, reversed and sped up
// 1.25x, so the logo takes itself apart. Trimmed BEFORE reversing on purpose:
// reversing the untrimmed clip would turn its trailing fade-out into a fade-in
// and the outro would open on nothing instead of the settled lockup. This is
// the duration ffprobe reports for outro-light.mp4, not 4.1/1.25.
export const OUTRO_SEC = 3.33;
export const WIDTH = 1920;
export const HEIGHT = 1080;
