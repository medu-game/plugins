import React from 'react';
import { Easing, Img, interpolate, staticFile } from 'remotion';
import { MARK, MARK_COLORS, markBars, markChevron, markRows } from './LogoMark';
import { HEIGHT, WIDTH } from './constants';

/**
 * Flowkeeper's logo animation, rebuilt.
 *
 * It used to be intro-light.mp4, a clip whose mark disagrees with the shipped
 * logo: bars up to 1.6x too short, chevron 1.17x too big, and a chevron that
 * was keyed to alpha 0 rather than painted white. Tim asked for the whole thing
 * again with the real logo, so the clip, the still cut out of it and the
 * reversed outro are all replaced by this.
 *
 * The BEATS are measured off that clip frame by frame, because the intro music
 * is cut to them (make-intro-music.mjs peaks at MARK_LANDS_AT_SEC) and the
 * caption file offsets every cue by INTRO_SEC. The choreography is the clip's;
 * only the logo inside it is different, and the sizes come from MARK rather
 * than from the clip, since the clip's bars are the thing that was wrong.
 */
export const BEATS = {
  /** Three bars streak in from the left, staggered, and decelerate into a stack. */
  barsIn: [0.07, 0.62] as const,
  barStagger: [0, 0.05, 0.1] as const,
  /** The stack, still oversized, settles to the size it has inside the disc. */
  stackSettle: [0.8, 1.2] as const,
  /** The disc grows behind the bars, with a ring that expands past it and fades. */
  discIn: [1.2, 1.47] as const,
  ring: [1.2, 1.6] as const,
  /** The chevron does not fly in. It fades up in place. */
  chevronIn: [1.37, 1.6] as const,
  /** The mark slides left and shrinks while the wordmark wipes in beside it. */
  slide: [2.3, 2.85] as const,
  word: [2.32, 2.72] as const,
} as const;

/**
 * The lockup's proportions, in disc diameters, measured on the app's own
 * logo_text_right.svg. The wordmark is an image on purpose: it never deforms,
 * it only reveals, and setting it as text would be the same "rebuilt by hand"
 * mistake one layer up.
 */
export const LOCKUP = {
  wordX0: 1.3219,
  wordX1: 4.7619,
  wordY0: 0.2095,
  wordY1: 0.7867,
  totalW: 4.7638,
} as const;

/**
 * Where the lockup sits when the build is done. Both were measured against
 * Tim's design, so the WIDTH is what is preserved here and the disc size
 * follows from it. The shipped logo carries a relatively wider wordmark than
 * the clip's did, so the disc lands about 11 percent smaller than it used to
 * for the same lockup width.
 */
export const LOCKUP_SETTLED = { cx: 952, cy: 540, width: 803 } as const;

/** The mark alone, before the wordmark exists, is centred on the stage. */
const MARK_ALONE = { cx: WIDTH / 2, cy: HEIGHT / 2, D: 264 } as const;

const ease = (t: number, [a, b]: readonly [number, number], easing = Easing.out(Easing.cubic)) =>
  interpolate(t, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });

const BAR_BOX = {
  x0: MARK.left - MARK.S / 2,
  x1: MARK.bar1X + MARK.S / 2,
  y0: MARK.cy - MARK.dy - MARK.S / 2,
  y1: MARK.cy + MARK.dy + MARK.S / 2,
};

/** Sampled off the clip at 1.2 to 1.5s, where the ring reads as a pale mint on
 *  the intro's grey ground rather than as the logo green. */
const RING_COLOR = '#B1DFCC';
/** How much bigger the flying stack is than the settled one. From the clip. */
const STACK_OVERSIZE = 1.68;
/** Where the assembled stack sits just before it settles, relative to centre. */
const STACK_DRIFT_X = -46;

export const LogoBuild: React.FC<{ sec: number; id?: string }> = ({ sec, id = 'fk-build' }) => {
  const settledD = LOCKUP_SETTLED.width / LOCKUP.totalW;
  const slide = ease(sec, BEATS.slide, Easing.out(Easing.cubic));

  const D = interpolate(slide, [0, 1], [MARK_ALONE.D, settledD]);
  const markCx = interpolate(
    slide,
    [0, 1],
    [MARK_ALONE.cx, LOCKUP_SETTLED.cx - LOCKUP_SETTLED.width / 2 + settledD / 2],
  );
  const markLeft = markCx - D / 2;
  const markTop = LOCKUP_SETTLED.cy - D / 2;
  const k = D / 525;

  // Before the disc exists the stack is oversized and drifting in from the left,
  // so it is drawn in its own box rather than in the mark's.
  const settle = ease(sec, BEATS.stackSettle, Easing.inOut(Easing.cubic));
  const stackScale = interpolate(settle, [0, 1], [STACK_OVERSIZE, 1]);
  const stackDx = interpolate(settle, [0, 1], [STACK_DRIFT_X, 0]);

  const discIn = ease(sec, BEATS.discIn);
  const ringT = ease(sec, BEATS.ring, Easing.linear);
  const chevron = ease(sec, BEATS.chevronIn, Easing.inOut(Easing.quad));
  const word = ease(sec, BEATS.word, Easing.out(Easing.cubic));

  const rows = markRows();
  const bars = markBars();

  // Each bar streaks in from off-stage left, stretched along its travel, and the
  // stretch relaxes as it stops. Distances are in mark units so they scale.
  const barEnter = (i: number) => {
    const [a, b] = BEATS.barsIn;
    const t = ease(sec, [a + BEATS.barStagger[i], b + BEATS.barStagger[i]]);
    return { dx: interpolate(t, [0, 1], [-1600 / k, 0]), stretch: interpolate(t, [0, 1], [2.4, 1]) };
  };

  const stageBars = (
    <g>
      {bars.map((bar, i) => {
        const { dx, stretch } = barEnter(i);
        const cx = (bar.x1 + bar.x2) / 2;
        return (
          <line
            key={bar.y}
            x1={bar.x1}
            y1={bar.y}
            x2={bar.x2}
            y2={bar.y}
            transform={`translate(${dx} 0) translate(${cx} 0) scale(${stretch} 1) translate(${-cx} 0)`}
          />
        );
      })}
    </g>
  );

  const barsSettled = discIn > 0;
  const stackBoxD = D * stackScale;
  const stackK = stackBoxD / 525;

  return (
    <>
      {/* The stack while it is still its own object, before the disc catches it. */}
      {!barsSettled && (
        <svg
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ position: 'absolute', inset: 0 }}
        >
          <g
            transform={`translate(${MARK_ALONE.cx + stackDx} ${MARK_ALONE.cy}) scale(${stackK}) translate(${-(BAR_BOX.x0 + BAR_BOX.x1) / 2} ${-MARK.cy})`}
            stroke={MARK_COLORS.bars}
            strokeWidth={MARK.S}
            strokeLinecap="round"
          >
            {stageBars}
          </g>
        </svg>
      )}

      {/* The ring the disc arrives with: it expands past the disc and fades out. */}
      {ringT > 0 && ringT < 1 && (
        <svg
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ position: 'absolute', inset: 0 }}
        >
          <circle
            cx={markCx}
            cy={LOCKUP_SETTLED.cy}
            r={interpolate(ringT, [0, 1], [D * 0.62, D * 0.83])}
            fill="none"
            stroke={RING_COLOR}
            strokeWidth={8}
            opacity={interpolate(ringT, [0, 0.25, 1], [0, 1, 0])}
          />
        </svg>
      )}

      {barsSettled && (
        <svg
          viewBox="0 0 525 525"
          width={D}
          height={D}
          style={{ position: 'absolute', left: markLeft, top: markTop }}
        >
          <defs>
            <clipPath id={`${id}-disc`}>
              <circle cx={MARK.cx} cy={MARK.cy} r={MARK.r} />
            </clipPath>
            <filter id={`${id}-shadow`} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow
                dx={MARK.shadow.dx}
                dy={MARK.shadow.dy}
                stdDeviation={MARK.shadow.blur}
                floodColor="#000000"
                floodOpacity={MARK.shadow.opacity}
              />
            </filter>
          </defs>
          <circle
            cx={MARK.cx}
            cy={MARK.cy}
            r={MARK.r * discIn}
            fill={MARK_COLORS.disc}
          />
          <g clipPath={`url(#${id}-disc)`}>
            <g
              filter={`url(#${id}-shadow)`}
              stroke={MARK_COLORS.bars}
              strokeWidth={MARK.S}
              strokeLinecap="round"
            >
              {bars.map((bar) => (
                <line key={bar.y} x1={bar.x1} y1={bar.y} x2={bar.x2} y2={bar.y} />
              ))}
            </g>
            {chevron > 0 && (
              <path
                filter={`url(#${id}-shadow)`}
                d={markChevron()}
                fill="none"
                stroke={MARK_COLORS.chevron}
                strokeWidth={MARK.S}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={chevron}
                transform={`translate(${MARK.apexX} ${rows[1]}) scale(${interpolate(chevron, [0, 1], [1.06, 1])}) translate(${-MARK.apexX} ${-rows[1]})`}
              />
            )}
          </g>
        </svg>
      )}

      {word > 0 && (
        <div
          style={{
            position: 'absolute',
            left: markLeft + LOCKUP.wordX0 * D,
            top: markTop + LOCKUP.wordY0 * D,
            width: (LOCKUP.wordX1 - LOCKUP.wordX0) * D,
            height: (LOCKUP.wordY1 - LOCKUP.wordY0) * D,
            clipPath: `inset(0 ${(1 - word) * 100}% 0 0)`,
          }}
        >
          <Img
            src={staticFile('logo-wordmark.png')}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
      )}
    </>
  );
};
