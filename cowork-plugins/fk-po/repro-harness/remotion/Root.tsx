import React from 'react';
import { AbsoluteFill, Composition, useCurrentFrame } from 'remotion';
import {
  ReproVideo,
  reproVideoDefaultProps,
  type ReproVideoProps,
} from './ReproVideo';
import {
  HelpVideo,
  helpVideoDefaultProps,
  type HelpVideoProps,
} from './HelpVideo';
import { FPS, HEIGHT, INTRO_CLIP_SEC, INTRO_SEC, OUTRO_SEC, WIDTH } from './constants';
import { DesignCard, type CardContent } from './Cards';
import { LogoMark } from './LogoMark';
import { LogoBuild } from './LogoBuild';
// A committed placeholder: studio.sh hands the studio the staged run with
// --props, so this only shows when nothing was staged. It must always exist.
import studioProps from './studio-props.json';
import { TWEAKS } from './tweaks';

// One interstitial on its own, so a card can be checked against Tim's
// reference animation without rendering a whole video around it. The three
// designs each run about 5s in the source.
const CARD_PREVIEW_SEC = 5;

// The mark on its own, at the size of the app's own asset, so it can be diffed
// against it. check-logo-mark.mjs proves the geometry; this proves the render.
const MARK_PREVIEW = 525;

// The logo animation on its own, on the ground the intro opens on, so its beats
// can be checked without rendering a whole video around it.
const BuildPreview: React.FC = () => {
  const sec = useCurrentFrame() / FPS;
  return (
    <AbsoluteFill style={{ backgroundColor: TWEAKS.intro.bgFrom }}>
      <LogoBuild sec={sec} id="fk-preview" />
    </AbsoluteFill>
  );
};

export const Root = () => (
  <>
    <Composition
      id="LogoMark"
      component={LogoMark}
      width={MARK_PREVIEW}
      height={MARK_PREVIEW}
      fps={FPS}
      durationInFrames={1}
      defaultProps={{ size: MARK_PREVIEW }}
    />
    <Composition
      id="LogoBuild"
      component={BuildPreview}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={Math.round(INTRO_CLIP_SEC * FPS)}
    />
    <Composition
      id="CardPreview"
      component={DesignCard}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={Math.round(CARD_PREVIEW_SEC * FPS)}
      defaultProps={{
        durationSec: CARD_PREVIEW_SEC,
        content: {
          design: 'flows',
          eyebrow: 'Hoofdstuk 02',
          title: 'Flows opzetten',
          subtitle:
            'Hoe een terugkerende taakreeks per cliënt eruitziet, en wie welke stap oppakt.',
          step: 2,
        } satisfies CardContent,
      }}
    />
    <Composition
      id="ReproVideo"
      component={ReproVideo}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={30 * FPS}
      defaultProps={reproVideoDefaultProps}
      calculateMetadata={({ props }: { props: ReproVideoProps }) => ({
        durationInFrames: Math.max(
          FPS,
          Math.round((INTRO_SEC + props.captureDurationSec + OUTRO_SEC) * FPS),
        ),
      })}
    />
    <Composition
      id="HelpVideo"
      component={HelpVideo}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={30 * FPS}
      defaultProps={
        (studioProps as HelpVideoProps).beats.length > 0
          ? (studioProps as HelpVideoProps)
          : helpVideoDefaultProps
      }
      calculateMetadata={({ props }: { props: HelpVideoProps }) => ({
        durationInFrames: Math.max(
          FPS,
          Math.round((INTRO_SEC + props.captureDurationSec + OUTRO_SEC) * FPS),
        ),
      })}
    />
  </>
);
