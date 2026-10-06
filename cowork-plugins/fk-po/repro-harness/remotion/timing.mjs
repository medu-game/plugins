// Timing constants in plain JS so the Node stages (narrate, render-help,
// captions) and the Remotion composition read the same numbers. A subtitle
// offset that silently disagrees with the intro length is invisible until a
// customer notices, so there is exactly one definition of it.
export const FPS = 30;
// How long the logo animation runs before the settled lockup starts moving into
// the design. It was the point at which the old intro clip began fading its
// logo out; LogoBuild holds the lockup instead, but the number is kept because
// the intro music is cut to it.
export const INTRO_CLIP_SEC = 4.1;
// The whole intro: the logo animation, the lockup moving up into the design's
// position, then the title and the one-line explanation, held long enough to
// read. Tim asked for longer on 2026-08-25: at 7.0s the text stood for about
// 1.5s, which is not enough for a title plus two lines. The subtitle file
// offsets every cue by this, so it must match or the captions drift.
export const INTRO_SEC = 8.5;
// The music spans the whole intro and fades as the voice-over starts, so its
// length follows INTRO_SEC. That is not the flat bed this had two revisions
// ago: the loud moment is cued to the logo landing and what carries on under
// the title screen is that cue's own tail. Tim's call on 2026-08-25, after
// hearing a 3s cue leave 5.5s of silence over the part where the title
// appears.
export const INTRO_MUSIC_SEC = INTRO_SEC;
// The outro is the build run backwards, so the logo takes itself apart. It used
// to be a second mp4 that ffmpeg had trimmed and reversed, and this is the
// duration ffprobe reported for that file rather than 4.1/1.25. Kept as it is,
// so the speed-up stays INTRO_CLIP_SEC / OUTRO_SEC.
export const OUTRO_SEC = 3.33;
export const WIDTH = 1920;
export const HEIGHT = 1080;
