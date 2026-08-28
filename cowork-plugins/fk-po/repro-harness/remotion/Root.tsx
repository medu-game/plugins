import { Composition } from 'remotion';
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
import { FPS, HEIGHT, INTRO_SEC, OUTRO_SEC, WIDTH } from './constants';
import { DesignCard, type CardContent } from './Cards';
// Overwritten by stage-only.mjs so the studio opens on the last real run.
// The committed copy is a placeholder, which is why it must always exist.
import studioProps from './studio-props.json';

// One interstitial on its own, so a card can be checked against Tim's
// reference animation without rendering a whole video around it. The three
// designs each run about 5s in the source.
const CARD_PREVIEW_SEC = 5;

export const Root = () => (
  <>
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
