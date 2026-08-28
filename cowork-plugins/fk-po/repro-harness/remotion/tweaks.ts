// Elke visuele knop van de help-video staat hier. Pas een getal aan, kijk in
// de studio (`npm run studio`) en zie het meteen. Niets in dit bestand raakt
// de opname of de stem, dus je hoeft nooit opnieuw op te nemen of te laten
// inspreken om iets hier te veranderen.
//
// De drie stappen kosten heel verschillend werk:
//   narrate  API-tegoed, alleen nodig als de TEKST verandert
//   record   dev-stack en browser, alleen nodig als de FLOW of TIMING verandert
//   render   traag, nodig bij elke visuele tweak
// Alles hieronder zit in stap drie.

export const TWEAKS = {
  intro: {
    /** Flowkeeper's eigen logo-animatie. 'intro-dark.mp4' of 'intro-light.mp4'.
     *  Beide 1920x1080, 30fps, 4,5 seconden, zonder geluid. Wissel je van clip
     *  met een andere lengte, pas dan INTRO_CLIP_SEC in remotion/timing.mjs
     *  aan, anders lopen de ondertitels scheef. */
    clip: 'intro-light.mp4',
    /** Het uitgesneden logo van datzelfde clipframe, met doorzichtige
     *  achtergrond, zodat het over wit kan bewegen. Gemaakt uit de clip zelf,
     *  niet nagebouwd: de overgang is daardoor een knip tussen dezelfde
     *  pixels in plaats van een kruisfade. */
    lockup: 'intro-lockup-light.png',
    /** Hoe lang het logo erover doet om naar zijn plek in het design te
     *  schuiven en te verkleinen. */
    moveSec: 0.6,
    /** Pauze tussen het einde van die beweging en de titel. */
    textAfterSec: 0.1,

    /** De maten hieronder zijn gemeten in flowkeeper_intro.png, niet geschat.
     *  Verander je er een, meet het gerenderde frame dan opnieuw na. */
    ruleTop: 426,
    ruleWidth: 84,
    ruleHeight: 6,
    titleTop: 512,
    titleSize: 108,
    titleLineHeight: 0.88,
    /** HankenGrotesk is breder dan het font in Tims design-PNG, dus dezelfde
     *  zin breekt hier een woord eerder af. De letterhoogte klopt wel, en die
     *  kleiner maken om de afbreking te kopieren zou de titel zichtbaar
     *  kleiner maken dan het design. Dit is dus een bewuste afwijking. */
    titleTracking: '0em',
    titleMaxWidth: 1240,
    /** De uitleg hangt onder de titel, niet op een vaste hoogte. Het design
     *  heeft een titel van twee regels; bij een titel van een regel zou een
     *  vaste hoogte een gat laten vallen. Gemeten door het gerenderde frame tegen het design te leggen: 36px tussen
     *  de regelbakken van titel en uitleg. */
    subtitleGap: 36,
    subtitleSize: 40,
    subtitleLineHeight: 1.5,
    subtitleMaxWidth: 1010,

    /** De clip staat op grijs, het design op wit. De achtergrond schuift mee
     *  met de logo-beweging, zodat de twee veranderingen elkaar verbergen. */
    bgFrom: '#EBEBEB',
    bgTo: '#FFFFFF',
  },

  outro: {
    /** De intro achterstevoren en iets sneller: het logo pakt zichzelf weer
     *  uit. Geen titel, geen uitleg, geen geluid. Gemaakt uit intro-light.mp4
     *  met ffmpeg; wissel je van clip, pas dan OUTRO_SEC in
     *  remotion/timing.mjs aan naar wat ffprobe zegt. */
    clip: 'outro-light.mp4',
  },

  camera: {
    /** Hoe ver de camera inzoomt op het element waar de stem het over heeft.
     *  Onder 1.15 past het venster niet meer beeldvullend en zie je de
     *  achtergrond langs de randen. 1.0 zet de camera helemaal stil. */
    maxScale: 1.36,
    /** Basisduur van een cameraverplaatsing. Een verre sprong duurt vanzelf
     *  langer, tot maximaal 2,2 keer deze waarde. */
    easeSec: 0.9,
    /** Na een tussenscherm de camera eerst wijd openen en dan weer inzoomen.
     *  Op 0 sinds de kaarten hard knippen: dat opengaan bestond om een fade te
     *  verbergen, en na een harde knip is het juist de schok. */
    cardRecoverSec: 0,
  },

  window: {
    /** Nepbrowserbalk boven de opname. Op false verdwijnt de balk en wordt de
     *  opname navenant hoger. */
    showChrome: true,
    chromeHeight: 44,
    /** Wat er in de adresbalk staat. */
    url: 'app.flowkeeper.nl',
    cornerRadius: 20,
  },

  caption: {
    /** De pill onderin met de gesproken zin. */
    show: true,
    fontSize: 31,
    bottomMargin: 66,
    maxWidth: 1440,
    background: 'rgba(10,7,24,0.84)',
  },

  card: {
    /** De tussenschermen. Ze knippen hard in en uit: fade met transparantie
     *  maakt het druk, want je ziet de app er even doorheen. */
    titleSize: 74,
    showEyebrow: true,
    showChevrons: true,

    /** De merknaam linksonder op het takenscherm, zoals in Tims animatie. */
    showLogo: true,
  },

  /** Dunne voortgangslijn onderlangs de hele video. */
  progressBar: {
    show: true,
    height: 5,
  },

  audio: {
    /** Een gegenereerd muziekje dat de hele intro overspant: het luidste punt
     *  ligt op de landing van het logo, en de staart daarvan loopt door onder
     *  het titelscherm tot de voice-over begint. Lengte en fade zitten in het
     *  bestand zelf, gemaakt door make-intro-music.mjs; hier staat alleen nog
     *  het volume. Op null zetten maakt de intro stil. */
    introMusic: { file: 'intro-music.mp3', volume: 0.35 } as
      | { file: string; volume: number }
      | null,

    /** Kort geluidje op het moment dat een tussenscherm verschijnt. De kaarten
     *  hebben geen stem meer, en zonder markering knipt er iets in beeld
     *  zonder dat je hoort dat er iets gebeurt. Op null zetten maakt ze stil. */
    cardCue: { file: 'sfx-ping.mp3', volume: 0.3 } as
      | { file: string; volume: number }
      | null,
  },
} as const;
