import React from 'react';
import { BRAND } from './brand';

/**
 * The Flowkeeper mark, in code, faithful to the shipped logo.
 *
 * Every number is in units of a 525px disc and was FITTED to the app's own
 * asset (frontend-application/public/logo.svg, a 525x525 PNG), not traced by
 * eye. Coordinate descent leaves 26 of 260038 unambiguous pixels on the wrong
 * shape, 0.010 percent. Re-run that with `node check-logo-mark.mjs`.
 *
 * Three earlier attempts to redraw this logo by hand went wrong, which is why
 * the cards carry an image. This one is different in kind: the construction is
 * derived, and the check is a pixel comparison against the app rather than a
 * look at the render.
 *
 * The construction, which is what makes an animation possible at all:
 *  - one number S is both the bar height and the chevron stroke width
 *  - the three bars sit on the chevron's three key rows, cy - dy, cy, cy + dy
 *  - bar 1 ends where the top arm ends, bar 2 ends at the vertex, so the bars
 *    run into the mark rather than stopping near it
 *
 * bar1X and bar2X end UNDER the chevron, so the raster cannot pin them down:
 * bar1X is free over about 20px below the value here and bar2X over about 10px
 * either side. They only become visible if the bars animate in on their own.
 */
export const MARK = {
  cx: 262.5,
  cy: 262.75,
  r: 262.5,
  S: 62,
  dy: 103,
  left: 156.75,
  bar1X: 367.25,
  bar2X: 269.75,
  bar3X: 192.25,
  apexX: 269.875,
  armX: 368.25,
  /** The asset carries a soft shadow. Fitted on its blue field: RMS 6.44 without, 2.14 with. */
  shadow: { dx: 30, dy: 30, blur: 55, opacity: 0.123 },
} as const;

export const MARK_COLORS = {
  disc: BRAND.blue600,
  bars: BRAND.green600,
  chevron: BRAND.surface,
} as const;

export const markRows = (m: typeof MARK = MARK) => [m.cy - m.dy, m.cy, m.cy + m.dy] as const;

export const markBars = (m: typeof MARK = MARK) => {
  const rows = markRows(m);
  return [
    { y: rows[0], x1: m.left, x2: m.bar1X },
    { y: rows[1], x1: m.left, x2: m.bar2X },
    { y: rows[2], x1: m.left, x2: m.bar3X },
  ];
};

export const markChevron = (m: typeof MARK = MARK, k = 1) => {
  const rows = markRows(m);
  return `M${m.armX * k} ${rows[0] * k} L${m.apexX * k} ${rows[1] * k} L${m.armX * k} ${rows[2] * k}`;
};

/**
 * `id` has to be unique per instance: the clip path and the filter are
 * referenced by url(#...), and two marks on one page with the same id share the
 * first one's definitions.
 */
export const LogoMark: React.FC<{ size?: number; id?: string; style?: React.CSSProperties }> = ({
  size = 525,
  id = 'fk-mark',
  style,
}) => {
  const m = MARK;
  const k = size / 525;
  const s = (v: number) => v * k;
  const bars = markBars(m);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <defs>
        <clipPath id={`${id}-disc`}>
          <circle cx={s(m.cx)} cy={s(m.cy)} r={s(m.r)} />
        </clipPath>
        <filter id={`${id}-shadow`} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx={s(m.shadow.dx)}
            dy={s(m.shadow.dy)}
            stdDeviation={s(m.shadow.blur)}
            floodColor="#000000"
            floodOpacity={m.shadow.opacity}
          />
        </filter>
      </defs>
      <circle cx={s(m.cx)} cy={s(m.cy)} r={s(m.r)} fill={MARK_COLORS.disc} />
      <g clipPath={`url(#${id}-disc)`}>
        <g
          filter={`url(#${id}-shadow)`}
          stroke={MARK_COLORS.bars}
          strokeWidth={s(m.S)}
          strokeLinecap="round"
        >
          {bars.map((b) => (
            <line key={b.y} x1={s(b.x1)} y1={s(b.y)} x2={s(b.x2)} y2={s(b.y)} />
          ))}
        </g>
        <path
          filter={`url(#${id}-shadow)`}
          d={markChevron(m, k)}
          fill="none"
          stroke={MARK_COLORS.chevron}
          strokeWidth={s(m.S)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
};
