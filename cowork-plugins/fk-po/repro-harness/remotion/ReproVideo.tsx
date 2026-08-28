// The one fixed template. The agent supplies props (from events.jsonl);
// nothing here is generated at runtime. All on-screen text is English
// (team convention: English everywhere). No em dashes.
import React from 'react';
import {
  AbsoluteFill,
  Easing,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {
  BRAND_ACCENT,
  BRAND_BG,
  BUG_RED,
  FPS,
  HEIGHT,
  INTRO_SEC,
  OUTRO_SEC,
  WIDTH,
} from './constants';

export type ReproVideoProps = {
  title: string;
  env: string;
  date: string;
  ticket: string | null;
  captureDurationSec: number;
  steps: { startSec: number; label: string }[];
  clicks: { atSec: number; x: number; y: number }[];
  bugMomentSec: number | null;
};

export const reproVideoDefaultProps: ReproVideoProps = {
  title: 'Bug reproduction',
  env: 'acceptance',
  date: '2026-01-01',
  ticket: null,
  captureDurationSec: 25,
  steps: [],
  clicks: [],
  bugMomentSec: null,
};

const font = {
  fontFamily: 'Helvetica, Arial, sans-serif',
  color: 'white',
} as const;

export const Card: React.FC<{ lines: string[] }> = ({ lines }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND_BG,
        justifyContent: 'center',
        alignItems: 'center',
        opacity,
      }}
    >
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            ...font,
            fontSize: i === 0 ? 78 : 42,
            fontWeight: i === 0 ? 700 : 400,
            marginTop: i === 0 ? 0 : 36,
            maxWidth: 1500,
            textAlign: 'center',
            color: i === 0 ? 'white' : '#9CA3AF',
          }}
        >
          {line}
        </div>
      ))}
    </AbsoluteFill>
  );
};

export const Cursor: React.FC<{ clicks: ReproVideoProps['clicks'] }> = ({
  clicks,
}) => {
  const frame = useCurrentFrame(); // relative to capture start
  const sec = frame / FPS;
  if (clicks.length === 0) return null;
  // Glide toward each click during the 0.6s before it, rest there after.
  let x = clicks[0].x;
  let y = clicks[0].y;
  for (let i = 0; i < clicks.length; i += 1) {
    const c = clicks[i];
    const from = i === 0 ? c : clicks[i - 1];
    if (sec >= c.atSec) {
      x = c.x;
      y = c.y;
    } else if (sec >= c.atSec - 0.6) {
      const p = interpolate(sec, [c.atSec - 0.6, c.atSec], [0, 1], {
        easing: Easing.inOut(Easing.quad),
      });
      x = from.x + (c.x - from.x) * p;
      y = from.y + (c.y - from.y) * p;
      break;
    } else {
      break;
    }
  }
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {clicks.map((c, i) => {
        const dt = sec - c.atSec;
        if (dt < 0 || dt > 0.7) return null;
        const r = interpolate(dt, [0, 0.7], [12, 70]);
        const o = interpolate(dt, [0, 0.7], [0.8, 0]);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: c.x - r,
              top: c.y - r,
              width: 2 * r,
              height: 2 * r,
              borderRadius: '50%',
              border: `4px solid ${BRAND_ACCENT}`,
              opacity: o,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: x - 13,
          top: y - 13,
          width: 26,
          height: 26,
          borderRadius: '50%',
          backgroundColor: BRAND_ACCENT,
          border: '3px solid white',
          boxShadow: '0 2px 9px rgba(0,0,0,0.5)',
        }}
      />
    </AbsoluteFill>
  );
};

const CaptionBar: React.FC<{ steps: ReproVideoProps['steps'] }> = ({
  steps,
}) => {
  const frame = useCurrentFrame();
  const sec = frame / FPS;
  const active = [...steps].reverse().find((s) => sec >= s.startSec);
  if (!active) return null;
  const index = steps.indexOf(active) + 1;
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          ...font,
          backgroundColor: 'rgba(17,24,39,0.85)',
          fontSize: 36,
          padding: '15px 33px',
          borderRadius: 14,
          marginBottom: 36,
          maxWidth: 1650,
        }}
      >
        {`Step ${index}: ${active.label}`}
      </div>
    </AbsoluteFill>
  );
};

const BugHighlight: React.FC<{ bugMomentSec: number }> = ({
  bugMomentSec,
}) => {
  const frame = useCurrentFrame();
  const sec = frame / FPS;
  const intensity = interpolate(
    sec,
    [bugMomentSec - 0.2, bugMomentSec + 0.3, bugMomentSec + 2.0],
    [0, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  if (intensity <= 0) return null;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        boxShadow: `inset 0 0 0 ${12 * intensity}px ${BUG_RED}`,
      }}
    >
      <div
        style={{
          ...font,
          position: 'absolute',
          top: 30,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: BUG_RED,
          opacity: intensity,
          fontSize: 40,
          fontWeight: 700,
          padding: '12px 30px',
          borderRadius: 14,
        }}
      >
        This is where it goes wrong
      </div>
    </AbsoluteFill>
  );
};

// The video and the cursor zoom together (cursor coordinates are page
// pixels), while the caption bar and the bug badge stay fixed on top so the
// push-in never shoves them out of frame.
const CaptureWithOverlays: React.FC<ReproVideoProps> = (props) => {
  const frame = useCurrentFrame();
  const sec = frame / FPS;
  let transform: string | undefined;
  let transformOrigin: string | undefined;
  if (props.bugMomentSec !== null) {
    // Subtle push-in toward the last click before the bug moment.
    const bugClick = [...props.clicks]
      .reverse()
      .find((c) => c.atSec <= props.bugMomentSec! + 0.5);
    const cx = bugClick ? bugClick.x : WIDTH / 2;
    const cy = bugClick ? bugClick.y : HEIGHT / 2;
    const scale = interpolate(
      sec,
      [
        props.bugMomentSec - 0.3,
        props.bugMomentSec + 0.4,
        props.bugMomentSec + 2.2,
        props.bugMomentSec + 2.8,
      ],
      [1, 1.35, 1.35, 1],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.quad),
      },
    );
    if (scale !== 1) {
      transform = `scale(${scale})`;
      transformOrigin = `${cx}px ${cy}px`;
    }
  }
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform, transformOrigin }}>
        <OffthreadVideo src={staticFile('capture.mp4')} muted />
        <Cursor clicks={props.clicks} />
      </AbsoluteFill>
      <CaptionBar steps={props.steps} />
      {props.bugMomentSec !== null ? (
        <BugHighlight bugMomentSec={props.bugMomentSec} />
      ) : null}
    </AbsoluteFill>
  );
};

export const ReproVideo: React.FC<ReproVideoProps> = (props) => {
  const introFrames = Math.round(INTRO_SEC * FPS);
  const captureFrames = Math.max(
    1,
    Math.round(props.captureDurationSec * FPS),
  );
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND_BG }}>
      <Sequence durationInFrames={introFrames}>
        <Card
          lines={[
            props.title,
            [props.ticket, `Environment: ${props.env}`, props.date]
              .filter(Boolean)
              .join('  |  '),
          ]}
        />
      </Sequence>
      <Sequence from={introFrames} durationInFrames={captureFrames}>
        <CaptureWithOverlays {...props} />
      </Sequence>
      <Sequence
        from={introFrames + captureFrames}
        durationInFrames={Math.round(OUTRO_SEC * FPS)}
      >
        <Card
          lines={[
            'End of reproduction',
            props.ticket ?? 'See the Jira ticket for the steps',
          ]}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
