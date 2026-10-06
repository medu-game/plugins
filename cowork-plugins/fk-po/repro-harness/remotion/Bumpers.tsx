// The chapter bumpers from Tim's "Flowkeeper bumpers" export (2026-10-02),
// ported from bumpers.jsx. Geometry, colours and timings are the source's; its
// animate()/Easing calls map one to one onto interpolate + Remotion Easing.
//
// Each bumper is 4s and starts and ends on its own empty background, so a hard
// cut in and out is clean. Text comes from the storyboard. On-screen text is
// Dutch, no em dashes (FE-COPY-1).
import React from 'react';
import { Easing, interpolate } from 'remotion';
import { BODY, DISPLAY } from './fonts';
import { BRAND } from './brand';

type EasingFn = (n: number) => number;

const EASE = {
  outQuart: Easing.out(Easing.poly(4)),
  inOutCubic: Easing.inOut(Easing.cubic),
  outQuad: Easing.out(Easing.quad),
  inQuad: Easing.in(Easing.quad),
  inCubic: Easing.in(Easing.cubic),
};

const OUT = 3.15;

const a = (t: number, from: number, to: number, start: number, end: number, easing: EasingFn = EASE.outQuart) =>
  interpolate(t, [start, end], [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });
const fade = (t: number, s: number, e: number, f = 0, to = 1) => a(t, f, to, s, e, EASE.outQuad);
const draw = (t: number, s: number, e: number) => a(t, 0, 1, s, e, EASE.inOutCubic);
const enter = (t: number, start: number, dist = 16): React.CSSProperties => ({
  opacity: fade(t, start, start + 0.45),
  transform: `translateY(${a(t, dist, 0, start, start + 0.7)}px)`,
});
const exit = (t: number, delay = 0): React.CSSProperties => ({
  opacity: fade(t, OUT + delay, OUT + delay + 0.45, 1, 0),
  transform: `translateY(${a(t, 0, -12, OUT + delay, OUT + delay + 0.5, EASE.inQuad)}px)`,
});

export type BumperContent = {
  num: string;
  label: string;
  title: string;
  sub: string | null;
  step: number;
  total: number;
};

type BumperProps = { t: number; p: BumperContent };

const TitleBlock: React.FC<{
  t: number;
  start: number;
  p: BumperContent;
  dark?: boolean;
  size: number;
  maxW: number;
}> = ({ t, start, p, dark, size, maxW }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: maxW, ...exit(t) }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, ...enter(t, start) }}>
      <span
        style={{ width: 12, height: 12, borderRadius: 999, background: dark ? BRAND.green600 : BRAND.blue600 }}
      />
      <span
        style={{
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: '-0.01em',
          color: dark ? BRAND.green : BRAND.blue600,
        }}
      >
        {p.label}
      </span>
    </div>
    <div style={{ clipPath: `inset(-0.1em ${(1 - draw(t, start + 0.15, start + 1.05)) * 100}% -0.2em 0)` }}>
      <div
        style={
          {
            fontFamily: DISPLAY,
            fontWeight: 700,
            fontSize: size,
            lineHeight: 1.04,
            letterSpacing: '-0.03em',
            color: dark ? BRAND.surface : BRAND.ink,
            textWrap: 'balance',
          } as React.CSSProperties
        }
      >
        {p.title}
      </div>
    </div>
    {p.sub ? (
      <div
        style={
          {
            fontFamily: BODY,
            fontSize: 32,
            lineHeight: 1.45,
            color: dark ? BRAND.lavender : BRAND.fg2,
            maxWidth: 880,
            textWrap: 'pretty',
            ...enter(t, start + 0.9, 20),
          } as React.CSSProperties
        }
      >
        {p.sub}
      </div>
    ) : null}
  </div>
);

/** 2a: the logo's three bars and chevron, at screen scale. */
export const Balken: React.FC<BumperProps> = ({ t, p }) => {
  const bars = [
    { y: 432, w: 640 },
    { y: 512, w: 760 },
    { y: 592, w: 420 },
  ];
  const chevX = a(t, -60, 0, 0.55, 1.15) + a(t, 0, 120, OUT, OUT + 0.55, EASE.inQuad);
  const chevO = fade(t, 0.55, 0.9) * fade(t, OUT, OUT + 0.45, 1, 0);
  return (
    <div style={{ position: 'absolute', inset: 0, background: BRAND.surface }}>
      {bars.map((b, i) => {
        const w =
          a(t, 0, b.w, 0.05 + i * 0.09, 0.85 + i * 0.09) *
          a(t, 1, 0, OUT + 0.05 + i * 0.07, OUT + 0.6 + i * 0.07, EASE.inCubic);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: -40,
              top: b.y,
              height: 56,
              width: w + 40,
              borderRadius: 999,
              background: BRAND.green,
            }}
          />
        );
      })}
      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{ position: 'absolute', inset: 0, opacity: chevO, transform: `translateX(${chevX}px)` }}
      >
        <path
          d="M850 360L1030 540L850 720"
          fill="none"
          stroke={BRAND.blue600}
          strokeWidth={56}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div
        style={{ position: 'absolute', left: 1160, top: 0, bottom: 0, right: 120, display: 'flex', alignItems: 'center' }}
      >
        <TitleBlock t={t} start={0.75} p={p} size={104} maxW={660} />
      </div>
    </div>
  );
};

/** 2b: a vertical stepper that shows where in the series this chapter is. */
export const Stappen: React.FC<BumperProps> = ({ t, p }) => {
  const n = Math.max(2, p.total);
  const cur = Math.min(n, Math.max(1, p.step));
  const gap = Math.min(128, 640 / (n - 1));
  const y0 = 540 - ((n - 1) * gap) / 2;
  const yCur = y0 + (cur - 1) * gap;
  const yEnd = y0 + (n - 1) * gap;
  const grayP = draw(t, 0.05, 0.75);
  const mintP = draw(t, 0.45, 0.45 + 0.18 * cur);
  const doneAt = (i: number) => 0.45 + 0.18 * (i + 1);
  return (
    <div style={{ position: 'absolute', inset: 0, background: BRAND.paper }}>
      <svg
        width={420}
        height={1080}
        viewBox="0 0 420 1080"
        style={{ position: 'absolute', left: 0, top: 0, ...exit(t, 0.1) }}
      >
        <path
          d={`M200 ${y0}V${yEnd}`}
          stroke={BRAND.cardBorder}
          strokeWidth={3}
          pathLength={1}
          strokeDasharray="1"
          strokeDashoffset={1 - grayP}
        />
        {cur > 1 ? (
          <path
            d={`M200 ${y0}V${yCur}`}
            stroke={BRAND.green600}
            strokeWidth={5}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={1 - mintP}
          />
        ) : null}
        {Array.from({ length: n }, (_, i) => {
          const y = y0 + i * gap;
          const done = i + 1 < cur;
          const active = i + 1 === cur;
          const appear = 0.05 + i * 0.07;
          const filled = done ? fade(t, doneAt(i) - 0.12, doneAt(i) + 0.08) : 0;
          const ring = active ? a(t, 0.4, 1, doneAt(i) - 0.1, doneAt(i) + 0.35) : 1;
          return (
            <g key={i} opacity={fade(t, appear, appear + 0.3)}>
              <circle
                cx={200}
                cy={y}
                r={active ? 22 * ring : 14}
                fill={BRAND.paper}
                stroke={active ? BRAND.blue600 : BRAND.gray300}
                strokeWidth={active ? 5 : 3}
              />
              {done ? <circle cx={200} cy={y} r={16} fill={BRAND.green600} opacity={filled} /> : null}
              {active ? (
                <circle
                  cx={200}
                  cy={y}
                  r={40 * ring}
                  fill="none"
                  stroke={BRAND.blue500}
                  strokeWidth={2}
                  opacity={0.25 * fade(t, doneAt(i), doneAt(i) + 0.4)}
                />
              ) : null}
              <text
                x={96}
                y={y + 8}
                fontFamily={DISPLAY}
                fontWeight={700}
                fontSize={24}
                fill={active ? BRAND.blue600 : BRAND.fg3}
                textAnchor="start"
              >
                {String(i + 1).padStart(2, '0')}
              </text>
            </g>
          );
        })}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 340,
          top: 0,
          bottom: 0,
          width: 1,
          background: BRAND.cardBorder,
          transformOrigin: 'top',
          transform: `scaleY(${draw(t, 0, 0.8)})`,
          opacity: fade(t, OUT, OUT + 0.4, 1, 0),
        }}
      />
      <div
        style={{ position: 'absolute', left: 480, right: 160, top: 0, bottom: 0, display: 'flex', alignItems: 'center' }}
      >
        <TitleBlock t={t} start={doneAt(cur - 1) - 0.15} p={p} size={128} maxW={1200} />
      </div>
    </div>
  );
};

/** 2c: on indigo, five lines draw and merge into one mint chevron. */
export const Stromen: React.FC<BumperProps> = ({ t, p }) => {
  const ys = [660, 740, 820, 900, 980];
  const cy = 820;
  const cx = 1500;
  const chevX = a(t, -50, 0, 0.95, 1.5) + a(t, 0, 520, OUT + 0.1, OUT + 0.75, EASE.inCubic);
  return (
    <div style={{ position: 'absolute', inset: 0, background: BRAND.blue800 }}>
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        {[0, 1, 3, 4, 2].map((i) => {
          const y = ys[i];
          const s = i * 0.08;
          const off = 1 - draw(t, s, 1.1 + s) - draw(t, OUT - 0.05 + s, OUT + 0.6 + s);
          const centre = i === 2;
          const spread = Math.abs(i - 2);
          return (
            <path
              key={i}
              d={
                centre
                  ? `M-20 ${cy}H${cx - 6}`
                  : `M-20 ${y}H${760 + spread * 60}C${1020 + spread * 30} ${y} ${1080} ${cy} ${1280} ${cy}`
              }
              fill="none"
              stroke={centre ? BRAND.green : BRAND.blue500}
              strokeWidth={centre ? 6 : 3}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={off}
            />
          );
        })}
        <g opacity={fade(t, 0.95, 1.3)} transform={`translate(${chevX} 0)`}>
          <path
            d={`M${cx - 96} ${cy - 96}L${cx} ${cy}L${cx - 96} ${cy + 96}`}
            fill="none"
            stroke={BRAND.green}
            strokeWidth={20}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
      <div style={{ position: 'absolute', left: 160, top: 170, right: 160 }}>
        <TitleBlock t={t} start={0.45} p={p} dark size={128} maxW={1300} />
      </div>
    </div>
  );
};
