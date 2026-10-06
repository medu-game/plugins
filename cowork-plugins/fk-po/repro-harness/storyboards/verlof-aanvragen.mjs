// Help video: an employee requests leave and hands their tasks to a colleague.
//
// Selectors were read off the running app on 2026-08-28, not guessed. Narration
// is Dutch and free of em dashes, because it becomes both the spoken track and
// the subtitle file (FE-COPY-1).
//
// `speech` is what the voice says, `narration` is what the viewer reads. Cards
// carry neither: their words live in cardTitle and cardSubtitle.
//
// WHY THE LEAVE PERIOD IS COMPUTED AND NOT WRITTEN DOWN
// Step 3 of the wizard cannot be passed with zero affected tasks: canProceed is
// false when totalTasks === 0, and the backend rejects task_transfers below one
// item. So the period has to hold at least one of the recording account's own
// flow tasks, or the video dead-ends halfway (FK-652 covers the dead end itself).
//
// The demo seeder lays a period's tasks out one day at a time from the START of
// that period, so the current month's tasks sit in its first few days and
// nowhere else (FK-655). The default below therefore tracks the start of the
// current month rather than naming a date: a fixed date silently stops holding
// tasks the moment the preview is reseeded, which is exactly how the previous
// July window died.
//
// Until FK-655 is fixed this is still narrow. Recording late in a month may find
// no tasks at all. Override both dates when that happens:
//   FK_HELP_ABSENCE_START=2026-10-01 FK_HELP_ABSENCE_END=2026-10-10
//
// AFTER A RUN THE ACCOUNT HOLDS A PENDING ABSENCE
// A second run fails validation on overlapping_absence, and Mijn afwezigheid is
// no longer empty, which also changes the selectors below (see the note on
// VERLOF). Cancel it first: Beheer, Gebruikers, Afwezigheden, Annuleren. On the
// recording preview a full reseed is the cheaper reset, because it restores the
// empty card as well as removing the absence.
//
// A PROBE RUN COUNTS AS A RUN. dryRunStoryboard executes every beat's action,
// this storyboard's last action is Indienen ter goedkeuring, so probing leaves a
// real pending absence behind. Reset before the recording session, not after.
export const meta = {
  slug: 'verlof-aanvragen',
  title: 'Verlof aanvragen',
  subtitle: 'Je vakantie doorgeven en je taken netjes overdragen aan een collega.',
  account: 'help',
};

// Names the app renders from the recording account's own data rather than from
// anything this file controls. The defaults are the dev-stack account, so
// recording elsewhere means setting both, or the run waits 30 seconds on a name
// that is not on screen.
const COLLEGA_NAAM = process.env.FK_HELP_COLLEAGUE_NAME || 'Emma Jansen';
// Only needed when the account is in more than one company, which is every
// account on a preview: the seeder puts all demo members in both.
const COMPANY_NAAM = process.env.FK_HELP_COMPANY_NAME || undefined;

const MAANDEN = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const VANDAAG = new Date();
// The 1st to the 10th. Ten days covers every task the seeder lays down for the
// month and reads as a holiday rather than a long weekend.
//
// It does NOT buy more affected tasks, which was measured rather than assumed:
// the monthly tasks all sit in the first four days, so days 5 to 10 are empty
// and widening the window changed the count not at all. What actually decides
// how many tasks step 3 shows is assigned_to, which is `$users->random()` per
// reseed. Two reseeds an hour apart on 2026-09-01 gave the recording account
// four affected tasks and then one. Until FK-655 makes that deterministic, the
// video can film a handover of a single task, and nothing here can prevent it.
const EERSTE_VAN_DE_MAAND = new Date(VANDAAG.getFullYear(), VANDAAG.getMonth(), 1);
const TIENDE_VAN_DE_MAAND = new Date(VANDAAG.getFullYear(), VANDAAG.getMonth(), 10);

const START_DATUM = process.env.FK_HELP_ABSENCE_START || iso(EERSTE_VAN_DE_MAAND);
const EIND_DATUM = process.env.FK_HELP_ABSENCE_END || iso(TIENDE_VAN_DE_MAAND);

// Spoken and typed wording follows the dates. Writing '1 juli' next to a date
// constant is how the two drift apart, and the drift is only visible in the
// finished video.
const label = (isoDate) => {
  const [, m, d] = isoDate.split('-');
  return `${Number(d)} ${MAANDEN[Number(m) - 1]}`;
};
const START_LABEL = label(START_DATUM);
const EIND_LABEL = label(EIND_DATUM);

// The picker opens on the current month, so a period inside it needs no
// navigation at all. Only an override reaching back a month pays for the arrow.
const maandenTerug = (isoDate) => {
  const [y, m] = isoDate.split('-').map(Number);
  return Math.max(0, (VANDAAG.getFullYear() - y) * 12 + (VANDAAG.getMonth() + 1 - m));
};

const MELDEN = 'button:has-text("Afwezigheid melden")';
// The absence entity carries no test id anywhere, so every handle below is a
// role plus an accessible name, or a form name the component sets itself.
// Scoped to the dialog, and so is everything else inside the wizard. Once the
// account holds one absence, Mijn afwezigheid renders a collapsible row whose
// button also contains the word Verlof, and it sits earlier in the DOM: an
// unscoped selector then expands that row instead of choosing the type. The
// probe passed on an empty card and the recording failed on a filled one, which
// is the whole difference.
const VERLOF = '[role="dialog"] button:has-text("Verlof")';
// has-text, not text-is: the Button component nests its label in two spans, so
// :text-is matches the innermost span and never the button itself. Measured on
// 2026-08-28, it cost a probe run. The calendar's month arrows carry their name
// in aria-label with no text node, so this cannot reach "Volgende maand".
const VOLGENDE = '[role="dialog"] button:has-text("Volgende")';
const START = '[role="dialog"] input[name="start_date"]';
const EIND = '[role="dialog"] input[name="end_date"]';
const VORIGE_MAAND = '[role="dialog"] button[aria-label="Vorige maand"]';
const DAG = (date) => `button[data-date="${date}"]`;
const OPMERKING = '[role="dialog"] textarea[name="note"]';
const WIJS_ALLES_TOE = '[role="dialog"] button:has-text("Wijs alles toe aan")';
const COLLEGA = `text="${COLLEGA_NAAM}"`;
const INDIENEN = '[role="dialog"] button:has-text("Indienen ter goedkeuring")';
// The wizard is a centred Modal, not the SideModal the task video films, so the
// panel is a different box: measured at x576 y277, 768x527 at 1920x1080. Its
// two children are the full-viewport overlay and then the panel, and it is the
// second one. Structural rather than semantic, because the panel carries only
// utility classes and no test id.
const PANEEL = '[role="dialog"] > div:nth-child(2)';
// The card the whole video starts and ends on. Anchored on its heading and
// climbed to the card element, so no utility class is involved.
const KAART = 'h3:has-text("Mijn afwezigheid") >> xpath=../..';

export async function setup({ page, run }) {
  await run.login({ company: COMPANY_NAAM });
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  // Settings resolves its route before the absence card has its data, so
  // without this the first beat films a card that is still loading.
  await page.locator(MELDEN).waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(1800);
}

export const beats = [
  {
    id: 'intro',
    narration:
      'Ga je een paar dagen weg? In Flowkeeper geef je dat zelf door, zodat je taken tijdens je vakantie niet blijven liggen.',
    wide: true,
  },
  {
    id: 'kaart-start',
    kind: 'card',
    cardDesign: 'deadlines',
    cardTitle: 'Verlof aanvragen',
    cardSubtitle: 'Van je eerste vrije dag tot de collega die je taken overneemt.',
    cardStep: 1,
  },
  {
    id: 'melden',
    narration:
      'Onder Instellingen staat het blok Mijn afwezigheid. Daar begin je met de knop Afwezigheid melden.',
    action: ({ run }) => run.click(MELDEN, 'Afwezigheid melden'),
    focus: MELDEN,
    // Let the camera reach the button before it is pressed, otherwise the
    // wizard is already open by the time the viewer is told to click.
    preRollSec: 2.2,
    // The modal fades in after the click; leaving early films it half open.
    minSec: 6.5,
  },
  {
    id: 'type',
    narration:
      'Kies eerst wat voor afwezigheid het is. Verlof heeft een vaste einddatum, dus op die dag sta je automatisch weer aan het werk.',
    action: async ({ page, run }) => {
      await run.click(VERLOF, 'Verlof');
      await page.waitForTimeout(1400);
      await run.click(VOLGENDE, 'Volgende');
      await page.locator(START).waitFor({ state: 'visible', timeout: 15_000 });
    },
    focus: VERLOF,
    // The camera has to read the card BEFORE the action, because moving to the
    // next step takes it off screen and the selector stops matching.
    preRollSec: 1.6,
    minSec: 8.0,
  },
  {
    id: 'periode',
    narration:
      'Zet daarna de periode: je eerste vrije dag en de dag waarop je weer terug bent.',
    action: async ({ page, run }) => {
      const kiesDag = async (veld, isoDate, tekst) => {
        await run.click(veld, tekst === START_LABEL ? 'Startdatum' : 'Einddatum');
        for (let i = 0; i < maandenTerug(isoDate); i += 1) {
          await page.locator(VORIGE_MAAND).waitFor({ state: 'visible', timeout: 10_000 });
          await run.click(VORIGE_MAAND, 'Vorige maand');
        }
        await page.locator(DAG(isoDate)).waitFor({ state: 'visible', timeout: 10_000 });
        await run.click(DAG(isoDate), tekst);
      };

      await kiesDag(START, START_DATUM, START_LABEL);
      await page.waitForTimeout(700);
      await kiesDag(EIND, EIND_DATUM, EIND_LABEL);
      await page.waitForTimeout(600);
    },
    focus: PANEEL,
    minSec: 9.0,
  },
  {
    id: 'opmerking',
    narration:
      'De opmerking is optioneel. Alleen de mensen die je aanvraag goedkeuren lezen die mee.',
    // Only fills the field. Moving to step 3 belongs to the NEXT beat: this line
    // runs 5.8s and the fill takes about 2s, so clicking Volgende here left
    // three and a half seconds of a sentence about the note playing over the
    // replacements table. Measured on the first render.
    action: async ({ page, run }) => {
      await run.fill(OPMERKING, `Vakantie. Na ${EIND_LABEL} ben ik weer bereikbaar.`, 'Opmerking');
      await page.waitForTimeout(900);
    },
    focus: PANEEL,
    minSec: 7.0,
  },
  {
    // A card that does work. The affected-tasks call takes about seven seconds
    // on the preview, and neither neighbouring beat can absorb that: put the
    // step change at the end of the note beat and its sentence plays over the
    // task table, put it at the start of the replacements beat and that
    // sentence plays over a spinner. Both were measured, in that order.
    //
    // So the transition happens behind a chapter card. Cards are silent and
    // full screen, so the load is invisible, and the sentence that describes
    // the task list finally lands on a task list. runStoryboard runs a card's
    // action like any other, and pads the beat to durationSec, so the card is
    // on screen for the whole load as long as beats.json gives it enough.
    id: 'kaart-vervangers',
    kind: 'card',
    cardDesign: 'clienten',
    cardTitle: 'Wie neemt je taken over',
    cardSubtitle: 'Flowkeeper zoekt op welke taken in je verlof vallen.',
    cardStep: 2,
    action: async ({ page, run }) => {
      await run.click(VOLGENDE, 'Volgende');
      // .first(), because BulkAssignDropdown puts a Button inside the
      // DropdownToggle button, so the selector matches two nested elements and
      // a bare waitFor fails strict mode. run.click narrows the same way.
      await page
        .locator(WIJS_ALLES_TOE)
        .first()
        .waitFor({ state: 'visible', timeout: 20_000 });
      await page.waitForTimeout(600);
    },
  },
  {
    id: 'vervangers',
    narration:
      'In stap drie laat Flowkeeper zien welke taken in die periode op jouw naam staan. Elke taak heeft een vervanger nodig.',
    focus: PANEEL,
    minSec: 7.5,
  },
  {
    id: 'toewijzen',
    narration:
      'Met Wijs alles toe aan geef je ze in één keer aan dezelfde collega.',
    action: async ({ page, run }) => {
      await run.click(WIJS_ALLES_TOE, 'Wijs alles toe aan');
      await page.locator(COLLEGA).first().waitFor({ state: 'visible', timeout: 10_000 });
      await page.waitForTimeout(1500);
      await run.click(COLLEGA, COLLEGA_NAAM);
      await page.waitForTimeout(900);
      await run.click(VOLGENDE, 'Volgende');
      await page.locator(INDIENEN).waitFor({ state: 'visible', timeout: 15_000 });
      await page.waitForTimeout(500);
    },
    focus: WIJS_ALLES_TOE,
    // Read the button before it is pressed: the dropdown that opens covers it,
    // and its label changes to the colleague's name afterwards.
    preRollSec: 1.4,
    minSec: 9.0,
  },
  {
    id: 'indienen',
    narration:
      'Het laatste scherm vat je aanvraag samen. Met Indienen ter goedkeuring stuur je hem weg.',
    action: async ({ page, run }) => {
      await run.click(INDIENEN, 'Indienen ter goedkeuring');
      await page.locator(MELDEN).waitFor({ state: 'visible', timeout: 20_000 });
      await page.waitForTimeout(1200);
    },
    focus: INDIENEN,
    // Long enough that the viewer can read the summary before the button is
    // pressed: this is the only beat that shows step 4 at all.
    preRollSec: 3.2,
    minSec: 8.5,
  },
  {
    id: 'kaart-klaar',
    kind: 'card',
    cardDesign: 'flows',
    cardEyebrow: 'Klaar',
    cardTitle: 'Aanvraag verstuurd',
    cardSubtitle: 'Je volgt de status bij Mijn afwezigheid.',
    cardStep: 3,
  },
  {
    id: 'status',
    narration:
      'Je aanvraag staat nu bij Mijn afwezigheid, met de periode, het aantal taken en de status. Zodra hij is goedgekeurd, gaat je verlof vanzelf in.',
    // Wide, not zoomed: the card is 1768px across and the camera's maxScale of
    // 1.36 shows 1412px, so a zoomed frame cuts off exactly the status badge
    // this line asks the viewer to look at.
    wide: true,
    focus: KAART,
    minSec: 8.0,
  },
];
