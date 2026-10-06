// Help video: a user builds a flow template for the VAT return, with the three
// tasks that belong to it.
//
// Selectors were read off the frontend source (origin/acceptance, which is what
// the preview this records against is built from), not guessed. Narration is
// Dutch and free of em dashes, because it becomes both the spoken track and the
// subtitle file (FE-COPY-1).
//
// Recorded against the OLD workflow editor on purpose: FK-707 (status dropdown
// out, three buttons in, activate/deactivate on the card) is in develop since
// 2026-10-01 but is not on the preview this account lives on. PO decision on
// 2026-10-02: record now, re-record the tail when FK-707 reaches this
// environment. The beats deliberately never name the status dropdown or the
// bottom "Opslaan & publiceren" button, so only the last two beats are at risk.
export const meta = {
  slug: 'flow-template-btw',
  title: 'Een flow template maken',
  subtitle: 'Werk dat bij elke klant hetzelfde gaat, leg je een keer vast en gebruik je daarna overal.',
  account: 'help',
};

// The recording writes a real flow template into the help account, and the
// backend rejects a duplicate name with a 422 that the editor swallows without
// a toast or a field error: the save then looks like a dead button. The setup
// guard below turns that into a readable failure, and this env var is how the
// probe run uses a throwaway name so it does not take the real one before the
// recording gets there.
const TEMPLATE_NAAM = process.env.FK_HELP_TEMPLATE_NAAM || 'Btw aangifte';

// PO values, 2026-10-02. `wachtdagen` is the time the work sits still waiting
// for the client and is only filled where it applies, which is why the first
// task is the one the narration explains the field on.
const TAKEN = [
  { naam: 'Opvragen ontbrekende stukken', minuten: '15', dagen: '1', wachtdagen: '7' },
  { naam: 'Administratie controleren', minuten: '90', dagen: '1' },
  { naam: 'Aangifte opstellen en verzenden', minuten: '15', dagen: '1' },
];

// Only needed when the account is in more than one company, which is every
// account on a preview: the seeder puts all demo members in both.
const COMPANY_NAAM = process.env.FK_HELP_COMPANY_NAME || undefined;

// The sidebar renders both its collapsed and its expanded variant, so the bare
// href matches two links of which only one is on screen. :visible picks the one
// the viewer can actually see; without it the camera measures a hidden element
// and gets no box at all.
const TEMPLATES_NAV = 'a[href="/flow-templates"]:visible';
const NIEUW_TEMPLATE = 'button:has-text("Nieuw flow template")';

// Every input in the app is the same `Input` component: a relative div holding
// the label and, beside it, the box with the input. The label carries htmlFor
// but the editor passes no id, so the label is not associated and neither
// getByLabel nor an accessible name can reach these fields. The label text is
// still the only semantic handle on them, hence `div:has(> label...)`. The
// child combinator matters: without it the match walks up to the form, whose
// first input is the template name, and every field would be filled in the
// wrong box.
const veldMetLabel = (label, nth = 0) =>
  `div:has(> label:text-is("${label}")) input >> nth=${nth}`;

const TEMPLATE_NAAM_VELD = veldMetLabel('Naam', 0);
// The recurrence picker is not a plain Input: its block opens with a hidden
// input that holds the form value, so a positional match lands on something
// that has no box on screen and the camera cannot aim at it. The search box
// beside it carries the label as aria-label, which is the accessible handle.
const HERHALINGEN = 'input[aria-label="Toegestane herhalingen"]';
// "Naam" exists twice once a task row is open: the template's and the row's.
// The row is always last in the DOM, and only one row is expanded at a time
// because adding a task collapses the previous one, so nth=-1 is the open row.
const TAAK_NAAM_VELD = veldMetLabel('Naam', -1);
const TAAK_TIJD_VELD = veldMetLabel('Tijdsinschatting');
const TAAK_DOORLOOP_VELD = veldMetLabel('Doorlooptijd');
const TAAK_WACHTTIJD_VELD = veldMetLabel('Wachttijd op klant');

const VOLGENDE_STAP = 'button:has-text("Volgende stap toevoegen")';
const PARALLELLE_TAAK = 'button:has-text("Parallelle taak in deze stap")';
// The schedule panel under the task list, which draws a bar per step. It is the
// only place in the editor that shows the sequencing the narration explains, so
// the parallel beat aims at it rather than at the rows.
const TIJDLIJN = 'div:has(> div > span:text-is("Tijdlijn"))';
// The editor has two identical submit buttons, "Opslaan" in the header and
// "Opslaan & publiceren" at the bottom. text-is pins the header one, which is
// also the one that survives FK-707 in spirit: the bottom button is the one
// that changes.
// Every Button renders its label inside a span, so :text-is("Opslaan") matches
// that span and never the button. has-text matches both "Opslaan" and
// "Opslaan & publiceren"; the header one comes first in the DOM, and that is
// the one this video uses.
const OPSLAAN = 'button:has-text("Opslaan") >> nth=0';
// The steps section: a div holding the heading row and the task rows. The
// heading is an h3 one level down, so the chain needs both steps or the match
// lands on the narrow heading row instead of the block the camera should centre
// on. Focus is measured BEFORE a beat's action runs, so a task beat cannot aim
// at its own row: the row does not exist yet.
const STAPPEN_BLOK = 'div:has(> div > h3:text-is("Stappen"))';
const NIEUWE_KAART = `a[href^="/flow-templates/"]:has-text("${TEMPLATE_NAAM}")`;

export async function setup({ page, run }) {
  await run.login({ company: COMPANY_NAAM });

  // Land on the overview before the first beat so the sidebar click in beat 3
  // has something to leave, and so the duplicate check below reads the real
  // list rather than an empty dashboard.
  await page.locator(TEMPLATES_NAV).first().waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator(TEMPLATES_NAV).first().click();
  await page.waitForURL(/\/flow-templates/, { timeout: 20_000 });
  await page.locator(NIEUW_TEMPLATE).first().waitFor({ state: 'visible', timeout: 30_000 });

  // The duplicate guard. Without it the run finishes green while the save did
  // nothing: the closing beat would frame the template from the previous run
  // and the video would show a save that never happened.
  if (await page.locator(NIEUWE_KAART).count()) {
    throw new Error(
      `Er bestaat al een flow template met de naam "${TEMPLATE_NAAM}" op dit account. ` +
        'Verwijder dat template eerst, of draai met FK_HELP_TEMPLATE_NAAM="<andere naam>". ' +
        'De editor toont bij een dubbele naam geen enkele melding, dus zonder deze check ' +
        'lijkt opslaan gewoon niets te doen.'
    );
  }

  // Back to the dashboard: the video opens there, so the sidebar beat has a
  // journey to make.
  await page.goto(new URL('/dashboard', page.url()).toString());
  await page.waitForTimeout(2500);
}

// A new template opens with one empty task row already in place and expanded
// (`workflow?.tasks ?? [buildTask(1, 1)]`). The first task therefore fills that
// row; adding a step for it as well left a nameless task behind, which the save
// refuses with "Los de fouten in de taken op" and no video.
// Waiting for the name field to be visible is not enough after adding a step:
// the previous row's field is still on screen for a few frames, so the wait
// passes immediately, nth=-1 still points at the old row and the new task's
// values land on top of the previous one. Measured on probe 3: the second step
// survived because its fill came 100ms after the click, the third did not
// because it came in the same frame, and the saved template held two tasks
// instead of three. Waiting for the step header to appear is the state change
// itself, so the row is there before anything is typed.
const vulTaak = (taak, stap) => async ({ page, run }) => {
  if (stap > 1) {
    // run.click presses a measured coordinate rather than the element, so it
    // never scrolls. Each open task row makes the page taller, and on probe 4
    // the third press landed on empty space below the fold: the click was
    // logged, no step appeared, and the third task overwrote the second.
    // Scrolling first puts the button in the frame, which is also what the
    // viewer sees happen.
    await page.locator(VOLGENDE_STAP).first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await run.click(VOLGENDE_STAP, 'Volgende stap toevoegen');
    await page.locator(`text="Stap ${stap}"`).first().waitFor({ state: 'visible', timeout: 15_000 });
  }
  await page.locator(TAAK_NAAM_VELD).first().waitFor({ state: 'visible', timeout: 15_000 });
  await run.fill(TAAK_NAAM_VELD, taak.naam, 'Taaknaam');
  await run.fill(TAAK_TIJD_VELD, taak.minuten, 'Tijdsinschatting');
  await run.fill(TAAK_DOORLOOP_VELD, taak.dagen, 'Doorlooptijd');
  if (taak.wachtdagen) {
    await run.fill(TAAK_WACHTTIJD_VELD, taak.wachtdagen, 'Wachttijd op klant');
  }
};

export const beats = [
  {
    id: 'intro',
    narration:
      'Werk dat bij elke klant precies hetzelfde gaat, leg je in Flowkeeper een keer vast. Dat heet een flow template.',
    speech:
      'Werk dat bij élke klant precies hetzelfde gaat, leg je in Flowkeeper één keer vast. Dat heet ’n flow template.',
  },
  {
    id: 'kaart-start',
    kind: 'card',
    cardDesign: 'flows',
    cardTitle: 'Een flow template maken',
    cardSubtitle: 'De btw aangifte, met de drie taken die er elk kwartaal bij horen.',
    cardStep: 1,
  },
  {
    id: 'naar-templates',
    narration: 'Je vindt ze in het menu, onder Flow templates.',
    wide: true,
    action: async ({ page, run }) => {
      await run.click(TEMPLATES_NAV, 'Flow templates');
      await page.waitForURL(/\/flow-templates/, { timeout: 20_000 });
      await page.locator(NIEUW_TEMPLATE).first().waitFor({ state: 'visible', timeout: 20_000 });
    },
    focus: TEMPLATES_NAV,
    preRollSec: 1.8,
    minSec: 6.0,
  },
  {
    id: 'nieuw-template',
    narration: 'Onderin het overzicht staat de tegel voor een nieuw template.',
    action: async ({ page, run }) => {
      await run.click(NIEUW_TEMPLATE, 'Nieuw flow template');
      await page.locator(TEMPLATE_NAAM_VELD).first().waitFor({ state: 'visible', timeout: 20_000 });
    },
    focus: NIEUW_TEMPLATE,
    preRollSec: 2.0,
    minSec: 6.0,
  },
  {
    id: 'naam',
    narration: 'Geef het template een naam die je collega’s meteen herkennen.',
    action: ({ run }) => run.fill(TEMPLATE_NAAM_VELD, TEMPLATE_NAAM, 'Naam'),
    focus: TEMPLATE_NAAM_VELD,
    minSec: 5.5,
  },
  {
    id: 'herhalingen',
    narration:
      'Kies daarna in welke ritmes dit werk terugkomt. De btw aangifte doe je per kwartaal en voor sommige klanten maandelijks.',
    speech:
      'Kies daarna in welke ritmes dit werk terugkomt. De btw aangifte doe je per kwartáál en voor sommige klanten maandelijks.',
    // Open the list, let it be read, tick both, then close it again: left open
    // it covers the fields the next beat works in.
    action: async ({ page, run }) => {
      await run.click(HERHALINGEN, 'Toegestane herhalingen');
      await page.locator('text="Per kwartaal"').first().waitFor({ state: 'visible', timeout: 10_000 });
      await page.waitForTimeout(1200);
      await run.click('text="Per kwartaal"', 'Per kwartaal');
      await page.waitForTimeout(600);
      await run.click('text="Maandelijks"', 'Maandelijks');
      await page.waitForTimeout(600);
      await page.keyboard.press('Escape');
    },
    focus: HERHALINGEN,
    preRollSec: 1.2,
    minSec: 9.0,
  },
  {
    id: 'kaart-taken',
    kind: 'card',
    cardDesign: 'deadlines',
    cardEyebrow: 'De taken',
    cardTitle: 'Stap voor stap',
    cardSubtitle: 'Elke taak die bij de aangifte hoort, met de tijd die hij kost.',
    cardStep: 2,
  },
  {
    id: 'taak-een',
    narration:
      'De eerste taak staat al voor je klaar. Je vult de naam in, hoeveel tijd hij kost en hoeveel dagen hij mag duren. Wacht je op stukken van de klant, dan zet je die wachttijd er apart bij.',
    action: vulTaak(TAKEN[0], 1),
    focus: STAPPEN_BLOK,
    preRollSec: 1.0,
    minSec: 13.0,
  },
  {
    id: 'taak-twee',
    narration:
      'Met Volgende stap toevoegen komt de tweede erbij: het controleren van de administratie.',
    action: vulTaak(TAKEN[1], 2),
    focus: STAPPEN_BLOK,
    minSec: 8.0,
  },
  {
    id: 'taak-drie',
    narration:
      'En als laatste de aangifte zelf, opstellen en verzenden. De stappen lopen in deze volgorde: de volgende begint zodra de vorige klaar is.',
    action: vulTaak(TAKEN[2], 3),
    focus: STAPPEN_BLOK,
    minSec: 11.0,
  },
  {
    id: 'stappen-uitleg',
    narration:
      'Taken in dezelfde stap lopen naast elkaar, daar kan iedereen tegelijk aan beginnen. Een volgende stap start pas als de vorige klaar is. Met Parallelle taak in deze stap zet je er dus werk bij dat tegelijk mag en met Volgende stap toevoegen werk dat moet wachten.',
    speech:
      'Taken in dezélfde stap lopen naast elkaar, daar kan iedereen tegelijk aan beginnen. Een volgende stap start pas als de vorige klaar is. Met Parallelle taak in deze stap zet je er dus werk bij dat tegelijk mag en met Volgende stap toevoegen werk dat moet wachten.',
    // Scrolling is the action here: the panel sits under the task list, and the
    // beat is about what it shows rather than about changing anything.
    action: async ({ page }) => {
      // Centre it, do not just bring it into view. scrollIntoViewIfNeeded moves
      // the minimum, which parks the panel against the bottom edge, and the
      // subtitle box sits exactly there: in the first render this beat
      // explained a timeline the viewer could not see, with only "Stap 1" and a
      // sliver of its bar above the captions.
      await page.locator(TIJDLIJN).first().evaluate((el) => {
        el.scrollIntoView({ block: 'center' });
      });
      await page.waitForTimeout(900);
    },
    focus: TIJDLIJN,
    preRollSec: 0.8,
    minSec: 17.0,
  },
  // The scroll back up is its own beat on purpose. A beat runs its action AFTER
  // the pre-roll, so scrolling inside the save beat meant the viewer heard
  // "klik op Opslaan" while the screen was still at the timeline, and by the
  // time the header arrived the click had already happened and the overview was
  // on screen: measured in the first render, the button was never once visible
  // under its own instruction. Scrolling first puts the button in frame before
  // the save beat starts, so its pre-roll shows the cursor travelling to a
  // button the viewer can see.
  {
    id: 'naar-boven',
    narration: 'Het template is nu compleet.',
    action: async ({ page }) => {
      await page.locator(OPSLAAN).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
    },
    focus: STAPPEN_BLOK,
    preRollSec: 0.6,
    minSec: 4.0,
  },
  {
    id: 'opslaan',
    narration: 'Klik op Opslaan.',
    action: async ({ page, run }) => {
      await run.click(OPSLAAN, 'Opslaan');
      await page.waitForURL(/\/flow-templates$/, { timeout: 20_000 });
      await page.locator(NIEUWE_KAART).first().waitFor({ state: 'visible', timeout: 20_000 });
    },
    focus: OPSLAAN,
    preRollSec: 2.2,
    minSec: 5.0,
  },
  {
    id: 'klaar',
    // PO-correctie 2026-10-02: je activeert geen template. Bij de klant voeg je
    // een flow toe die op dit template draait ("+ Flow toevoegen", waarna de
    // wizard "Flow activeren" heet), of je doet er veel tegelijk met de
    // Excel-import. De oude zin zei dat je het template zelf vanaf het
    // overzicht activeert, en dat kan daar helemaal niet.
    narration:
      'Het template staat nu in je overzicht. Bij een klant voeg je er een flow mee toe en activeer je die. Wil je het voor veel klanten tegelijk, dan gaat dat met de Excel-import.',
    focus: NIEUWE_KAART,
    minSec: 9.0,
  },
];
