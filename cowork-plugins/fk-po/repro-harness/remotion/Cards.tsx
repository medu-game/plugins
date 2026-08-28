// The interstitial cards, ported from Tim's own "Tussenschermen animatie"
// bundle rather than rebuilt from the video. The bundle ships three designs as
// `interstitials.jsx`; this file is that code translated from its Stage runtime
// to Remotion, keeping the motion timings and the geometry.
//
// Two deliberate differences from the source:
//
// 1. The source runs all three chapters on one 15s timeline with absolute
//    times, and cross-fades between them. Here each card is its own beat with
//    its own duration, so every time is rebased to a local clock starting at
//    0, and the inter-chapter fades are gone. So are the chevrons that
//    travelled from chapter one into chapter two: there is no "into" between
//    independent cards.
// 2. The eyebrow, title, subtitle and step number come from the storyboard.
//    In the source they are hardcoded copy about flows, clients and deadlines.
//
// On-screen text is Dutch. No em dashes (FE-COPY-1).
import React from 'react';
import { Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont as loadDisplay } from '@remotion/google-fonts/HankenGrotesk';
import { loadFont as loadBody } from '@remotion/google-fonts/Inter';
import { BRAND } from './brand';
import { TWEAKS } from './tweaks';

const { fontFamily: DISPLAY } = loadDisplay();
const { fontFamily: BODY } = loadBody();

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Which of the three designs a card uses. The decoration is about a subject,
 *  so this is a content choice, not a colour choice. */
export type CardDesign = 'flows' | 'clienten' | 'deadlines';

/** Kept for storyboards written before designs were nameable. */
export type CardVariant = 'light' | 'indigo';

export type CardContent = {
  design?: CardDesign | null;
  variant?: CardVariant | null;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  step: number | null;
};

/** A storyboard that only says light or indigo still gets a sensible design. */
export function resolveDesign(content: CardContent): CardDesign {
  if (content.design) return content.design;
  return content.variant === 'indigo' ? 'clienten' : 'flows';
}

// The three motion helpers from the source. Nothing eases or transforms outside
// these, which is what keeps the three designs feeling like one piece.
const enter = (t: number, start: number, dist = 32, dur = 0.7) => ({
  opacity: interpolate(t, [start, start + dur * 0.7], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.quad),
  }),
  transform: `translateY(${interpolate(t, [start, start + dur], [dist, 0], {
    ...CLAMP,
    easing: Easing.out(Easing.poly(4)),
  })}px)`,
});

const draw = (t: number, start: number, end: number) =>
  interpolate(t, [start, end], [0, 1], { ...CLAMP, easing: Easing.inOut(Easing.cubic) });

const fade = (t: number, start: number, end: number, from = 0, to = 1) =>
  interpolate(t, [start, end], [from, to], { ...CLAMP, easing: Easing.out(Easing.quad) });

const ease = (
  t: number,
  start: number,
  end: number,
  from: number,
  to: number,
  easing = Easing.out(Easing.poly(4)),
) => interpolate(t, [start, end], [from, to], { ...CLAMP, easing });

/** Text that wipes in from the left instead of fading. */
const Reveal: React.FC<{
  t: number;
  start: number;
  end: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ t, start, end, children, style }) => (
  <div style={{ ...style, clipPath: `inset(0 ${(1 - draw(t, start, end)) * 100}% -0.15em 0)` }}>
    {children}
  </div>
);

const stepLabel = (step: number | null) => String(step ?? 1).padStart(2, '0');

/**
 * The chevron field. In the source it travels from chapter one into chapter
 * two, which is what puts it in two different places. Independent cards have no
 * journey between them, so each design that uses it names the end state it
 * wants and the field animates in there.
 */
const Chevrons: React.FC<{ t: number; start: number; placement: 'near' | 'far' }> = ({
  t,
  start,
  placement,
}) => {
  const travelled = placement === 'far';
  const transform = travelled
    ? 'translate(-60px, 220px) scale(1.32)'
    : 'translate(0px, 0px) scale(1)';
  return (
    <svg
      width={1920}
      height={1080}
      viewBox="0 0 1920 1080"
      style={{ position: 'absolute', inset: 0, opacity: fade(t, start, start + 0.8) }}
    >
      <g
        style={{ transformOrigin: '1680px 260px', transform }}
        stroke={BRAND.green}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {[0, 1].map((row) =>
          [0, 1, 2].map((col) => {
            const bx = 1560 + col * 90;
            const by = 200 + row * 200;
            const at = start + 0.1 + col * 0.16 + row * 0.1;
            return (
              <path
                key={`${row}-${col}`}
                d={`M${bx} ${by}L${bx + 60} ${by + 60}L${bx} ${by + 120}`}
                opacity={fade(t, at, at + 0.35) * (row === 1 ? 0.35 : 1) * (0.4 + col * 0.3)}
              />
            );
          }),
        )}
      </g>
    </svg>
  );
};

/**
 * The lockup this design carries bottom left. It is the real one, cropped out of
 * Flowkeeper's own logo animation, not drawn here.
 *
 * The source file draws it inline as an SVG and I ported that faithfully, which
 * was the wrong kind of faithful: its mark is an arrow pointing right where
 * Flowkeeper's is a chevron pointing left over three green bars. Tim spotted it
 * in the first render. Third time this pipeline has been bitten by rebuilding
 * that logo by hand, so this one is an image.
 */
const InlineLockup: React.FC<{ t: number; start: number }> = ({ t, start }) => (
  <div style={{ position: 'absolute', left: 140, bottom: 120, ...enter(t, start, 14) }}>
    <Img
      src={staticFile('logo-lockup-small.png')}
      style={{ height: 34, display: 'block' }}
    />
  </div>
);

/* ── flows: light, a horizontal flow line that draws itself ─────────────── */

const NODES: [number, number, number, string, string | null, number][] = [
  [160, 760, 12, BRAND.green600, null, 1.15],
  [700, 760, 12, BRAND.green600, null, 1.8],
  [1180, 700, 16, BRAND.paper, BRAND.blue600, 2.35],
  [1440, 640, 10, BRAND.paper, BRAND.gray300, 2.8],
  [1760, 640, 10, BRAND.paper, BRAND.gray300, 3.1],
];

const CardFlows: React.FC<{ t: number; content: CardContent }> = ({ t, content }) => (
  <div style={{ position: 'absolute', inset: 0, background: BRAND.paper }}>
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
      <g stroke={BRAND.cardBorder} strokeWidth={1}>
        <path d="M0 180H1920" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw(t, 0.15, 1.5)} />
        <path d="M0 900H1920" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw(t, 0.3, 1.7)} />
      </g>
      <path
        d="M160 760H700C760 760 780 700 840 700H1300C1360 700 1380 640 1440 640H1760"
        fill="none"
        stroke={BRAND.cardBorder}
        strokeWidth={2}
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - draw(t, 0.9, 2.4)}
      />
      <path
        d="M160 760H700C760 760 780 700 840 700H1180"
        fill="none"
        stroke={BRAND.green600}
        strokeWidth={4}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - draw(t, 1.2, 2.9)}
      />
      {NODES.map(([cx, cy, r, fill, stroke, at], i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill={fill}
          stroke={stroke ?? 'none'}
          strokeWidth={stroke ? 4 : 0}
          opacity={fade(t, at, at + 0.25)}
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transform: `scale(${ease(t, at, at + 0.4, 0.3, 1)})`,
          }}
        />
      ))}
    </svg>
    <Chevrons t={t} start={1.6} placement="near" />
    <div
      style={{
        position: 'absolute',
        left: 160,
        top: 260,
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        maxWidth: 1100,
      }}
    >
      {content.eyebrow ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, ...enter(t, 0.25, 16) }}>
          <span
            style={{
              fontFamily: DISPLAY,
              fontWeight: 700,
              fontSize: 24,
              color: BRAND.blue600,
              letterSpacing: '-0.01em',
            }}
          >
            {content.eyebrow}
          </span>
          <span style={{ height: 2, background: BRAND.gray300, width: ease(t, 0.5, 1.1, 0, 64) }} />
        </div>
      ) : null}
      <Reveal t={t} start={0.5} end={1.5}>
        <div
          style={{
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: 132,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            color: BRAND.ink,
          }}
        >
          {content.title}
        </div>
      </Reveal>
      {content.subtitle ? (
        <div
          style={{
            fontFamily: BODY,
            fontSize: 32,
            lineHeight: 1.5,
            color: BRAND.fg2,
            maxWidth: 900,
            ...enter(t, 1.25, 20),
          }}
        >
          {content.subtitle}
        </div>
      ) : null}
    </div>
  </div>
);

/* ── clienten: indigo, concentric circles and a giant outlined numeral ──── */

const CardClienten: React.FC<{ t: number; content: CardContent; endSec: number }> = ({
  t,
  content,
  endSec,
}) => (
  <div style={{ position: 'absolute', inset: 0, background: BRAND.blue800 }}>
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
      <g fill="none" stroke={BRAND.blue600} strokeWidth={2}>
        {[260, 400, 540, 680].map((r, i) => (
          <circle
            key={r}
            cx={1660}
            cy={540}
            r={r}
            opacity={fade(t, 0.2 + i * 0.14, 0.65 + i * 0.14)}
            style={{
              transformOrigin: '1660px 540px',
              transform: `scale(${ease(t, 0.2 + i * 0.14, endSec, 0.92, 1, Easing.out(Easing.sin))})`,
            }}
          />
        ))}
      </g>
      <text
        x={140}
        y={1010}
        fontFamily={DISPLAY}
        fontWeight={700}
        fontSize={420}
        letterSpacing={-20}
        fill="none"
        stroke={BRAND.blue500}
        strokeWidth={3}
        opacity={fade(t, 0.55, 1.45) * 0.7}
        style={{
          transformOrigin: '140px 1010px',
          transform: `scale(${ease(t, 0.55, endSec, 0.97, 1, Easing.out(Easing.sin))})`,
        }}
      >
        {stepLabel(content.step)}
      </text>
    </svg>
    <Chevrons t={t} start={0.5} placement="far" />
    <div
      style={{
        position: 'absolute',
        left: 160,
        top: 220,
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        maxWidth: 1080,
      }}
    >
      {content.eyebrow ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, ...enter(t, 0.2, 16) }}>
          <span style={{ width: 12, height: 12, background: BRAND.green600, borderRadius: 999 }} />
          <span
            style={{
              fontFamily: DISPLAY,
              fontWeight: 500,
              fontSize: 24,
              color: BRAND.green,
              letterSpacing: '0.02em',
            }}
          >
            {content.eyebrow}
          </span>
        </div>
      ) : null}
      <Reveal t={t} start={0.3} end={1.2}>
        <div
          style={{
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: 140,
            lineHeight: 1.02,
            letterSpacing: '-0.03em',
            color: BRAND.surface,
          }}
        >
          {content.title}
        </div>
      </Reveal>
      {content.subtitle ? (
        <div
          style={{
            fontFamily: BODY,
            fontSize: 32,
            lineHeight: 1.5,
            color: BRAND.lavender,
            maxWidth: 860,
            ...enter(t, 1.1, 20),
          }}
        >
          {content.subtitle}
        </div>
      ) : null}
    </div>
  </div>
);

/* ── deadlines: white, a column of task rows slides in from the right ───── */

const ROWS: { at: number; done?: boolean; active?: boolean }[] = [
  { at: 0.75, done: true },
  { at: 0.95, done: true },
  { at: 1.15, active: true },
  { at: 1.35 },
  { at: 1.55 },
];

const CardDeadlines: React.FC<{ t: number; content: CardContent }> = ({ t, content }) => (
  <div style={{ position: 'absolute', inset: 0, background: BRAND.surface }}>
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        width: 760,
        height: 1080,
        background: BRAND.gray50,
        borderLeft: `1px solid ${BRAND.cardBorder}`,
        transform: `translateX(${ease(t, 0.1, 0.9, 760, 0)}px)`,
      }}
    />
    <svg width={760} height={1080} viewBox="0 0 760 1080" style={{ position: 'absolute', right: 0, top: 0 }}>
      <path
        d="M160 218V618"
        stroke={BRAND.cardBorder}
        strokeWidth={2}
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - draw(t, 0.7, 1.65)}
      />
      <path
        d="M160 218V418"
        stroke={BRAND.green600}
        strokeWidth={4}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - draw(t, 1.55, 2.65)}
      />
    </svg>
    <div
      style={{
        position: 'absolute',
        right: 60,
        top: 180,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        width: 560,
      }}
    >
      {ROWS.map((r, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            opacity: fade(t, r.at, r.at + 0.3),
            transform: `translateX(${ease(t, r.at, r.at + 0.5, 28, 0)}px)`,
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              flex: 'none',
              boxSizing: 'border-box',
              background: r.done ? BRAND.green600 : BRAND.surface,
              border: r.done
                ? 'none'
                : `${r.active ? 4 : 3}px solid ${r.active ? BRAND.blue600 : BRAND.gray300}`,
            }}
          />
          <span
            style={{
              height: 76,
              flex: 1,
              borderRadius: 8,
              background: r.done || r.active ? BRAND.surface : BRAND.paper,
              border: `1px solid ${r.active ? BRAND.blue600 : BRAND.cardBorder}`,
              boxShadow: r.active ? '0 0 0 3px rgba(89,56,237,0.18)' : 'none',
            }}
          />
        </div>
      ))}
    </div>
    <div
      style={{
        position: 'absolute',
        left: 140,
        top: 300,
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        width: 900,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, ...enter(t, 0.2, 16) }}>
        <span
          style={{
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: 20,
            color: BRAND.surface,
            background: BRAND.blue600,
            padding: '8px 16px',
            borderRadius: 8,
          }}
        >
          {stepLabel(content.step)}
        </span>
        {content.eyebrow ? (
          <span style={{ fontFamily: DISPLAY, fontWeight: 500, fontSize: 24, color: BRAND.fg3 }}>
            {content.eyebrow}
          </span>
        ) : null}
      </div>
      <Reveal t={t} start={0.3} end={1.2}>
        <div
          style={{
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: 120,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            color: BRAND.ink,
          }}
        >
          {content.title}
        </div>
      </Reveal>
      {content.subtitle ? (
        <div
          style={{
            fontFamily: BODY,
            fontSize: 30,
            lineHeight: 1.5,
            color: BRAND.fg2,
            maxWidth: 760,
            ...enter(t, 1.1, 20),
          }}
        >
          {content.subtitle}
        </div>
      ) : null}
    </div>
    {TWEAKS.card.showLogo ? <InlineLockup t={t} start={2.65} /> : null}
  </div>
);

/**
 * One interstitial. `t` is seconds since the card appeared, not since the video
 * started: every timing in the three designs is relative to its own entrance.
 */
export const DesignCard: React.FC<{ content: CardContent; durationSec?: number }> = ({
  content,
  durationSec,
}) => {
  const { fps } = useVideoConfig();
  const t = useCurrentFrame() / fps;
  const endSec = durationSec ?? 5;
  const design = resolveDesign(content);

  if (design === 'clienten') return <CardClienten t={t} content={content} endSec={endSec} />;
  if (design === 'deadlines') return <CardDeadlines t={t} content={content} />;
  return <CardFlows t={t} content={content} />;
};
