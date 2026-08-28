// The help-centre template, dressed in the FlowKeeper design system.
//
// The visual language is ported from promo-film.jsx in the Claude Design
// project: brand backdrop, logo reveal, pill lower-third, arrow cursor with a
// green ripple, and the app parked in a rounded window that one continuous
// camera glides over. Only the language is ported, not the code: that file
// runs on Claude Design's own Stage runtime and animates hand-built mock
// screens, where this composition shows a real recording of the real app.
//
// On-screen text is Dutch, because this video is shown to customers.
// No em dashes (FE-COPY-1).
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Html5Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  interpolateColors,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import { loadFont as loadDisplay } from '@remotion/google-fonts/HankenGrotesk';
import { loadFont as loadBody } from '@remotion/google-fonts/Inter';
import { BRAND, PAGE_SCALE, STUDIO_BACKDROP, WINDOW } from './brand';
import {
  FPS,
  HEIGHT,
  INTRO_CLIP_SEC,
  INTRO_MUSIC_SEC,
  INTRO_SEC,
  OUTRO_SEC,
  WIDTH,
} from './constants';
import { DesignCard, type CardDesign, type CardVariant } from './Cards';
import { TWEAKS } from './tweaks';

const { fontFamily: DISPLAY } = loadDisplay();
const { fontFamily: BODY } = loadBody();

export type HelpBeat = {
  id: string;
  narration: string;
  /** Null on a card: those carry no voice. */
  audio: string | null;
  startSec: number;
  durationSec: number;
  focus: { x: number; y: number; width: number; height: number } | null;
  /** A 'card' beat covers the app with a full-screen brand statement. */
  kind?: 'screen' | 'card';
  /** Show the whole window for this beat instead of zooming to its focus. */
  wide?: boolean;
  cardTitle?: string | null;
  cardEyebrow?: string | null;
  cardSubtitle?: string | null;
  cardVariant?: CardVariant;
  /** Which of the three interstitial designs. Falls back to the variant. */
  cardDesign?: CardDesign | null;
  cardStep?: number | null;
};

export type HelpVideoProps = {
  title: string;
  subtitle: string;
  /** Seconds of setup (the login) to cut off the front of the capture. */
  captureStartSec: number;
  captureDurationSec: number;
  beats: HelpBeat[];
  clicks: { atSec: number; x: number; y: number }[];
};

export const helpVideoDefaultProps: HelpVideoProps = {
  title: 'Zo werkt het',
  subtitle: 'FlowKeeper helpcentrum',
  captureStartSec: 0,
  captureDurationSec: 25,
  beats: [],
  clicks: [],
};

// The window is smaller than the stage, so below WIDTH/WINDOW.width the frame
// cannot be filled by the app and backdrop leaks in at the edges. The close-up
// scale has to sit above that ratio (1.143) for the clamp to have any room.
const CAM_MAX_SCALE = TWEAKS.camera.maxScale;
const CAM_EASE_SEC = TWEAKS.camera.easeSec;
const CARD_RECOVER_SEC = TWEAKS.camera.cardRecoverSec;
const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
// Fake browser chrome above the recording. The capture keeps the rest.
const CHROME_H = TWEAKS.window.showChrome ? TWEAKS.window.chromeHeight : 0;
// Where the arrow tip sits inside the 44px cursor box.
const CURSOR_TIP = 4;
// The chrome bar sits ABOVE the video area rather than inside it, so WINDOW
// stays exactly 16:9 and one scale serves both the recording and the cursor.
const FRAME_H = WINDOW.height + CHROME_H;
// Page pixels reach the screen through this, whichever layer draws them.
const PAGE_TOP = WINDOW.y + CHROME_H;

function activeBeat(beats: HelpBeat[], sec: number): HelpBeat | null {
  return (
    [...beats].reverse().find((b) => sec >= b.startSec && sec < b.startSec + b.durationSec) ?? null
  );
}

// Where the lockup sits before and after the move. Both boxes were measured,
// not estimated: the bounding box of the non-background pixels in
// intro-light.mp4 at 4.0s, and the same lockup in Tim's flowkeeper_intro.png.
const LOCKUP_FROM = { cx: 952, cy: 540, width: 803 };
const LOCKUP_TO = { cx: 960, cy: 287.5, width: 561 };
const LOCKUP_SCALE = LOCKUP_TO.width / LOCKUP_FROM.width;

/**
 * The brand intro is Flowkeeper's own logo animation, not a rebuild of it.
 *
 * The clip fades its logo away over the last 0.4s, which is exactly the frame
 * the design builds on, so the clip stops at INTRO_CLIP_SEC and a cut-out still
 * of that same frame takes over. The still sits underneath at identical
 * geometry, so the handover is a cut between the same pixels rather than a
 * dissolve that could show a seam. It then rises and shrinks into the position
 * the design puts it in, while the ground fades from the clip's grey to the
 * design's white: two changes at once, each covering for the other.
 */
const IntroCard: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => {
  const sec = useCurrentFrame() / FPS;
  const move = interpolate(
    sec,
    [INTRO_CLIP_SEC, INTRO_CLIP_SEC + TWEAKS.intro.moveSec],
    [0, 1],
    { ...CLAMP, easing: Easing.inOut(Easing.cubic) },
  );
  const textAt = INTRO_CLIP_SEC + TWEAKS.intro.moveSec + TWEAKS.intro.textAfterSec;
  const reveal = (delay: number) =>
    interpolate(sec, [textAt + delay, textAt + delay + 0.5], [0, 1], {
      ...CLAMP,
      easing: Easing.out(Easing.cubic),
    });

  const scale = 1 + (LOCKUP_SCALE - 1) * move;
  const dx = (LOCKUP_TO.cx - LOCKUP_FROM.cx) * move;
  const dy = (LOCKUP_TO.cy - LOCKUP_FROM.cy) * move;

  const rule = reveal(0);
  const heading = reveal(0.12);
  const explain = reveal(0.24);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: interpolateColors(
          move,
          [0, 1],
          [TWEAKS.intro.bgFrom, TWEAKS.intro.bgTo],
        ),
      }}
    >
      <Img
        src={staticFile(TWEAKS.intro.lockup)}
        style={{
          width: WIDTH,
          height: HEIGHT,
          transformOrigin: `${LOCKUP_FROM.cx}px ${LOCKUP_FROM.cy}px`,
          transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
        }}
      />
      {sec < INTRO_CLIP_SEC ? (
        <AbsoluteFill>
          <OffthreadVideo
            src={staticFile(TWEAKS.intro.clip)}
            style={{ width: WIDTH, height: HEIGHT }}
          />
        </AbsoluteFill>
      ) : null}

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: TWEAKS.intro.ruleTop,
          display: 'flex',
          justifyContent: 'center',
          opacity: rule,
        }}
      >
        <div
          style={{
            width: TWEAKS.intro.ruleWidth,
            height: TWEAKS.intro.ruleHeight,
            borderRadius: TWEAKS.intro.ruleHeight / 2,
            backgroundColor: BRAND.green300,
          }}
        />
      </div>

      {/* Title and explanation share one flow block, so a one-line title pulls
          the explanation up with it and keeps the design's spacing instead of
          leaving a hole where the second line would have been. */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: TWEAKS.intro.titleTop }}>
        <div
          style={{
            maxWidth: TWEAKS.intro.titleMaxWidth,
            margin: '0 auto',
            textAlign: 'center',
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: TWEAKS.intro.titleSize,
            lineHeight: TWEAKS.intro.titleLineHeight,
            letterSpacing: TWEAKS.intro.titleTracking,
            color: BRAND.ink,
            opacity: heading,
            transform: `translateY(${(1 - heading) * 18}px)`,
          }}
        >
          {title}
        </div>
        <div
          style={{
            maxWidth: TWEAKS.intro.subtitleMaxWidth,
            margin: `${TWEAKS.intro.subtitleGap}px auto 0`,
            textAlign: 'center',
            fontFamily: BODY,
            fontSize: TWEAKS.intro.subtitleSize,
            lineHeight: TWEAKS.intro.subtitleLineHeight,
            color: BRAND.muted,
            opacity: explain,
            transform: `translateY(${(1 - explain) * 14}px)`,
          }}
        >
          {subtitle}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * The intro in reverse: the logo takes itself apart. No title, no subtitle, no
 * sound, which is Tim's call on 2026-08-25. The clip is prepared by ffmpeg
 * rather than animated here, for the same reason the intro is a clip: this is
 * Flowkeeper's own logo animation and rebuilding it by hand went wrong twice.
 */
const OutroCard: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: TWEAKS.intro.bgFrom }}>
    <OffthreadVideo
      src={staticFile(TWEAKS.outro.clip)}
      style={{ width: WIDTH, height: HEIGHT }}
    />
  </AbsoluteFill>
);

/** A designed full-screen statement between two screen beats. */
/**
 * A card cuts in and cuts out. It used to cross-fade, and the app showing
 * through a half-transparent full-screen statement is exactly the busy,
 * confusing moment Tim asked to remove: the card is a hard change of subject,
 * so it should read as one.
 *
 * The camera's post-card recovery went with the fade. Opening wide and zooming
 * back in was there to hide a dissolve; after a hard cut it is the jolt,
 * because you watch the app snap in at the wrong scale and then correct.
 *
 * Mounting is the Sequence's job now. It used to be the fade's: the card was
 * rendered for the whole capture and its opacity decided when you saw it, so
 * removing the fade left it on screen for the entire video. Its own Sequence
 * also gives the designs a clock that starts when the card appears, which is
 * what every timing inside them is relative to.
 */
const CardBeat: React.FC<{ beat: HelpBeat }> = ({ beat }) => (
  <AbsoluteFill>
    <DesignCard
      durationSec={beat.durationSec}
      content={{
        design: beat.cardDesign ?? null,
        variant: beat.cardVariant ?? null,
        eyebrow: beat.cardEyebrow ?? null,
        title: beat.cardTitle ?? beat.narration,
        subtitle: beat.cardSubtitle ?? null,
        step: beat.cardStep ?? null,
      }}
    />
  </AbsoluteFill>
);

/** Lower third, pill shaped over a blurred backdrop. */
const NarrationBar: React.FC<{ beats: HelpBeat[] }> = ({ beats }) => {
  const sec = useCurrentFrame() / FPS;
  const beat = activeBeat(beats, sec) ?? [...beats].reverse().find((b) => sec >= b.startSec);
  if (!beat || beat.kind === 'card' || !TWEAKS.caption.show) return null;

  const opacity = interpolate(sec, [beat.startSec, beat.startSec + 0.3], [0, 1], CLAMP);

  return (
    <AbsoluteFill
      style={{ justifyContent: 'flex-end', alignItems: 'center', pointerEvents: 'none' }}
    >
      <div
        style={{
          marginBottom: TWEAKS.caption.bottomMargin,
          maxWidth: TWEAKS.caption.maxWidth,
          padding: '17px 34px',
          background: TWEAKS.caption.background,
          backdropFilter: 'blur(10px)',
          borderRadius: 34,
          boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
          color: '#fff',
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: TWEAKS.caption.fontSize,
          lineHeight: 1.28,
          letterSpacing: '-0.015em',
          textAlign: 'center',
          opacity,
          transform: `translateY(${(1 - opacity) * 14}px)`,
        }}
      >
        {beat.narration}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Arrow cursor with a green click ripple. Coordinates arrive as page pixels
 * and are drawn in an unscaled 1920x1080 layer that the caller scales, so this
 * component must never apply PAGE_SCALE itself.
 */
const Cursor: React.FC<{ clicks: HelpVideoProps['clicks'] }> = ({ clicks }) => {
  const sec = useCurrentFrame() / FPS;
  if (clicks.length === 0) return null;

  let x = clicks[0].x;
  let y = clicks[0].y;
  for (let i = 0; i < clicks.length; i += 1) {
    const c = clicks[i];
    const from = i === 0 ? c : clicks[i - 1];
    if (sec >= c.atSec) {
      x = c.x;
      y = c.y;
    } else if (sec >= c.atSec - 0.7) {
      const p = interpolate(sec, [c.atSec - 0.7, c.atSec], [0, 1], {
        easing: Easing.inOut(Easing.cubic),
      });
      x = from.x + (c.x - from.x) * p;
      y = from.y + (c.y - from.y) * p;
      break;
    } else {
      break;
    }
  }

  const pressed = clicks.some((c) => sec >= c.atSec - 0.06 && sec <= c.atSec + 0.06);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {clicks.map((c, i) => {
        const dt = sec - c.atSec;
        if (dt < 0 || dt > 0.55) return null;
        const p = dt / 0.55;
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: c.x - 26,
              top: c.y - 26,
              width: 52,
              height: 52,
              borderRadius: 999,
              border: `3px solid ${BRAND.green}`,
              opacity: (1 - p) * 0.85,
              transform: `scale(${0.4 + p * 1.6})`,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          // The arrow tip is 4px into its own box, which is why the press
          // scales about that point. Offset by the same amount so the tip, not
          // the box corner, sits on the coordinate that was clicked.
          left: x - CURSOR_TIP,
          top: y - CURSOR_TIP,
          transform: `scale(${pressed ? 0.85 : 1})`,
          transformOrigin: `${CURSOR_TIP}px ${CURSOR_TIP}px`,
          filter: 'drop-shadow(0 3px 7px rgba(0,0,0,0.35))',
        }}
      >
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
          <path
            d="M5 3l14 7-6 1.5L10.5 18 5 3z"
            fill="#fff"
            stroke={BRAND.ink}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

/**
 * The app window on the studio backdrop, with one continuous camera.
 *
 * The camera eases from one beat's focus box to the next instead of ramping in
 * and back out inside every beat. That is what makes it read as a camera
 * rather than a series of jump cuts.
 */
const Stage: React.FC<HelpVideoProps> = (props) => {
  const sec = useCurrentFrame() / FPS;

  const centre = { x: WINDOW.x + WINDOW.width / 2, y: PAGE_TOP + WINDOW.height / 2 };
  const targets = props.beats
    .filter((b) => b.kind !== 'card' && b.focus)
    .map((b) => ({
      atSec: b.startSec,
      x: WINDOW.x + (b.focus!.x + b.focus!.width / 2) * PAGE_SCALE,
      y: PAGE_TOP + (b.focus!.y + b.focus!.height / 2) * PAGE_SCALE,
    }));

  let focusX = centre.x;
  let focusY = centre.y;
  let scale = 1;

  if (targets.length > 0) {
    // Ease INTO the running beat's target, never out of it ahead of time. A
    // camera that leaves early is still showing the previous subject while the
    // caption talks about it, which reads as the video losing its place.
    const currentIndex = targets.reduce((acc, t, i) => (sec >= t.atSec ? i : acc), -1);
    const current = currentIndex >= 0 ? targets[currentIndex] : { ...centre, atSec: 0 };
    const previous = currentIndex > 0 ? targets[currentIndex - 1] : { ...centre, atSec: 0 };

    // A move across the whole window cannot take the same time as a nudge, or
    // the long ones read as a lurch. Scale the travel time with the distance.
    const distance = Math.hypot(current.x - previous.x, current.y - previous.y);
    const travelSec = Math.min(
      CAM_EASE_SEC * 2.2,
      CAM_EASE_SEC * (0.55 + distance / WINDOW.width),
    );
    const p = interpolate(sec, [current.atSec, current.atSec + travelSec], [0, 1], {
      ...CLAMP,
      easing: Easing.inOut(Easing.cubic),
    });
    focusX = previous.x + (current.x - previous.x) * p;
    focusY = previous.y + (current.y - previous.y) * p;

    const first = targets[0].atSec;
    const end = props.captureDurationSec;
    scale = interpolate(
      sec,
      [first - CAM_EASE_SEC, first, end - CAM_EASE_SEC, end],
      [1, CAM_MAX_SCALE, CAM_MAX_SCALE, 1],
      { ...CLAMP, easing: Easing.inOut(Easing.cubic) },
    );

    // A beat can ask for the whole window. Used coming out of a card, where the
    // viewer has just been away from the app and needs to see where they are
    // before anything moves. Eased in and out over CAM_EASE_SEC so it reads as
    // the camera pulling back rather than a cut.
    for (const beat of props.beats.filter((b) => b.wide)) {
      const from = beat.startSec;
      const to = beat.startSec + beat.durationSec;
      if (sec < from - CAM_EASE_SEC || sec > to) continue;
      const q =
        sec < from
          ? interpolate(sec, [from - CAM_EASE_SEC, from], [0, 1], {
              ...CLAMP,
              easing: Easing.inOut(Easing.cubic),
            })
          : sec > to - CAM_EASE_SEC
            ? interpolate(sec, [to - CAM_EASE_SEC, to], [1, 0], {
                ...CLAMP,
                easing: Easing.inOut(Easing.cubic),
              })
            : 1;
      scale = scale + (1 - scale) * q;
    }

    // Only when TWEAKS.camera.cardRecoverSec is set. It is 0 now: opening wide
    // after a card existed to hide a dissolve, and the cards cut.
    for (const card of CARD_RECOVER_SEC > 0 ? props.beats.filter((b) => b.kind === 'card') : []) {
      const back = card.startSec + card.durationSec;
      if (sec >= back && sec < back + CARD_RECOVER_SEC) {
        const q = interpolate(sec, [back, back + CARD_RECOVER_SEC], [0, 1], {
          ...CLAMP,
          easing: Easing.inOut(Easing.cubic),
        });
        scale = 1 + (scale - 1) * q;
      }
    }
  }

  // Keep the visible rectangle inside the window. When the scale is too low
  // for that to be possible the whole window is on screen anyway, so centre on
  // it rather than drifting toward a corner and showing bare backdrop.
  const halfW = WIDTH / (2 * scale);
  const halfH = HEIGHT / (2 * scale);
  const minX = WINDOW.x + halfW;
  const maxX = WINDOW.x + WINDOW.width - halfW;
  const minY = PAGE_TOP + halfH;
  const maxY = PAGE_TOP + WINDOW.height - halfH;
  focusX = minX > maxX ? centre.x : Math.min(Math.max(focusX, minX), maxX);
  focusY = minY > maxY ? centre.y : Math.min(Math.max(focusY, minY), maxY);

  const tx = WIDTH / 2 - focusX * scale;
  const ty = HEIGHT / 2 - focusY * scale;

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: STUDIO_BACKDROP }} />
      <AbsoluteFill
        style={{ transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}
      >
        <div
          style={{
            position: 'absolute',
            left: WINDOW.x,
            top: WINDOW.y,
            width: WINDOW.width,
            height: FRAME_H,
            borderRadius: TWEAKS.window.cornerRadius,
            overflow: 'hidden',
            background: BRAND.surface,
            border: '1px solid rgba(255,255,255,0.6)',
            boxShadow: '0 50px 120px rgba(20,19,30,0.30), 0 12px 32px rgba(20,19,30,0.16)',
          }}
        >
          {TWEAKS.window.showChrome ? (
          <div
            style={{
              height: CHROME_H,
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '0 20px',
              background: '#EDEDF2',
              borderBottom: `1px solid ${BRAND.border}`,
            }}
          >
            {['#E85431', '#E3D332', '#09F087'].map((c) => (
              <span key={c} style={{ width: 12, height: 12, borderRadius: 999, background: c }} />
            ))}
            <div
              style={{
                marginLeft: 16,
                padding: '5px 16px',
                borderRadius: 999,
                background: '#FFFFFF',
                color: BRAND.muted,
                fontFamily: BODY,
                fontSize: 15,
              }}
            >
              {TWEAKS.window.url}
            </div>
          </div>
          ) : null}
          <OffthreadVideo
            src={staticFile('capture.mp4')}
            muted
            trimBefore={Math.round(props.captureStartSec * FPS)}
            style={{ width: '100%', height: WINDOW.height }}
          />
        </div>
        {/* Page pixels drawn full size, then scaled into the window, so the
            cursor rides exactly the same transform as the recording. */}
        <div
          style={{
            position: 'absolute',
            left: WINDOW.x,
            top: PAGE_TOP,
            width: WIDTH,
            height: HEIGHT,
            transformOrigin: '0 0',
            transform: `scale(${PAGE_SCALE})`,
          }}
        >
          <Cursor clicks={props.clicks} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** A thin brand-green line filling across the bottom for the whole runtime. */
const ProgressBar: React.FC<{ totalSec: number }> = ({ totalSec }) => {
  const p = Math.min(1, useCurrentFrame() / FPS / totalSec);
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', pointerEvents: 'none' }}>
      <div style={{ height: TWEAKS.progressBar.height, background: 'rgba(255,255,255,0.10)' }}>
        <div
          style={{
            height: '100%',
            width: `${p * 100}%`,
            background: `linear-gradient(90deg, ${BRAND.blue500}, ${BRAND.green})`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

/**
 * A cue over the logo build, not a bed under the whole intro, which is why its
 * sequence is INTRO_MUSIC_SEC and not INTRO_SEC: holding the title on screen
 * longer must not stretch the music across the part where nothing moves.
 *
 * The fade lives in the file, applied by make-intro-music.mjs, not here. It was
 * here first, and that meant the committed asset stopped dead when anyone
 * played it on its own while the video faded it properly. One of those two is
 * a lie, and the file is the thing people audition.
 */
const IntroMusic: React.FC<{ file: string; volume: number }> = ({ file, volume }) => (
  <Html5Audio src={staticFile(file)} volume={volume} />
);

export const HelpVideo: React.FC<HelpVideoProps> = (props) => {
  const introFrames = Math.round(INTRO_SEC * FPS);
  const captureFrames = Math.max(1, Math.round(props.captureDurationSec * FPS));
  const cardBeats = props.beats.filter((b) => b.kind === 'card');
  const cardCue = TWEAKS.audio.cardCue;

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.blue900 }}>
      <Sequence durationInFrames={introFrames}>
        <IntroCard title={props.title} subtitle={props.subtitle} />
      </Sequence>
      {TWEAKS.audio.introMusic ? (
        <Sequence durationInFrames={Math.round(INTRO_MUSIC_SEC * FPS)}>
          <IntroMusic {...TWEAKS.audio.introMusic} />
        </Sequence>
      ) : null}

      <Sequence from={introFrames} durationInFrames={captureFrames}>
        <Stage {...props} />
      </Sequence>

      {cardBeats.map((beat) => (
        <Sequence
          key={beat.id}
          from={introFrames + Math.round(beat.startSec * FPS)}
          durationInFrames={Math.max(1, Math.round(beat.durationSec * FPS))}
        >
          <CardBeat beat={beat} />
        </Sequence>
      ))}

      <Sequence from={introFrames} durationInFrames={captureFrames}>
        <NarrationBar beats={props.beats} />
      </Sequence>

      {props.beats
        .filter((beat) => beat.audio)
        .map((beat) => (
          <Sequence
            key={beat.id}
            from={introFrames + Math.round(beat.startSec * FPS)}
            durationInFrames={Math.max(1, Math.round(beat.durationSec * FPS))}
          >
            <Html5Audio src={staticFile(beat.audio as string)} />
          </Sequence>
        ))}

      {/* A card cuts in with no voice on it, so without this something changes
          on screen and nothing marks it. */}
      {cardCue
        ? cardBeats.map((beat) => (
            <Sequence
              key={`cue-${beat.id}`}
              from={introFrames + Math.round(beat.startSec * FPS)}
              durationInFrames={Math.max(1, Math.round(beat.durationSec * FPS))}
            >
              <Html5Audio
                src={staticFile(cardCue.file)}
                volume={cardCue.volume}
              />
            </Sequence>
          ))
        : null}

      <Sequence from={introFrames + captureFrames} durationInFrames={Math.round(OUTRO_SEC * FPS)}>
        <OutroCard />
      </Sequence>

      {TWEAKS.progressBar.show ? (
        <ProgressBar totalSec={INTRO_SEC + props.captureDurationSec + OUTRO_SEC} />
      ) : null}
    </AbsoluteFill>
  );
};
