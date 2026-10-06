// Help video: a customer creates a standalone task straight from the dashboard.
//
// Selectors were read off the running app, not guessed. Narration is Dutch and
// free of em dashes, because it becomes both the spoken track and the subtitle
// file (FE-COPY-1).
//
// `speech` is what the voice says, `narration` is what the viewer reads. Dutch
// stress needs the split: "een" is the article and "één" is the number, and
// only one of them is right to read out loud.
//
// Cards carry neither: they have no voice and no subtitle, so their words live
// in cardTitle and cardSubtitle and a narration on them would be a line nobody
// hears or reads.
//
// The recording account must run in Dutch, otherwise the picture is English
// while the voice is not. That is why this records as `help` rather than as the
// bug-video account: the help account is permanently Dutch, where flipping the
// bug-video one would silently turn another skill's English captions Dutch.
//
// To record against the local dev stack instead, point FK_HELP_BASE_URL at it
// and set that account's locale:
//
//   docker exec flowkeeper_dev_back_php php artisan tinker --execute="\
//     \App\Domains\User\Models\User::where('email','you@flowkeeper.nl')\
//       ->update(['locale' => 'nl']);"
//
// Set it back afterwards; it is a shared local account.

// The intro design puts the subtitle on screen as a sentence explaining the
// video, not as a brand line, so this is one line of user-facing Dutch copy
// and the no-em-dash rule applies to it.
export const meta = {
  slug: 'taak-aanmaken',
  title: 'Een taak aanmaken',
  subtitle: 'Een losse taak vastleggen en aan een collega geven, rechtstreeks vanaf je dashboard.',
  account: 'help',
};

// A task cannot be deleted, so every run leaves one behind. Change this name
// when an earlier run's row would sit next to the new one in the list.
const TAAK_NAAM = 'Q3-cijfers bespreken';

// Two handles the app renders from the recording account's own data rather than
// from anything this file controls: the assignee field shows the logged-in
// user's name, and the colleague has to be a real person in the same company.
// The defaults are the dev-stack account, so recording as the acceptance help
// account means setting both, or the run hangs 30 seconds on a name that is
// not on screen.
const EIGEN_NAAM = process.env.FK_HELP_OWNER_NAME || 'Bram Peters';
const COLLEGA_NAAM = process.env.FK_HELP_COLLEAGUE_NAME || 'Emma Jansen';
// Only needed when the account is in more than one company, which is every
// account on a preview: the seeder puts all demo members in both so company
// switching is testable. Empty is correct for a single-company account.
const COMPANY_NAAM = process.env.FK_HELP_COMPANY_NAME || undefined;

const NIEUWE_TAAK = 'button[aria-label="Nieuwe taak"]';
const NAAM = 'input[placeholder^="Bijv."]';
const TOELICHTING = 'textarea[placeholder^="Voeg context"]';
// The assignee field has no test id and only utility classes, so the account's
// own name is the most stable handle on it.
const TOEGEWEZEN = `button:has-text("${EIGEN_NAAM}")`;
// A colleague from the seeded demo data. Same dependency, same reason.
const COLLEGA = `text="${COLLEGA_NAAM}"`;
const AANMAKEN = 'button:has-text("Taak aanmaken")';
const TAKEN_NAV = 'a[href="/tasks"]';
// The task list is an AG Grid, so a row is role=row and a cell role=gridcell,
// neither is a tr. The camera aims at the NAME cell rather than the whole row:
// a row is 1716px wide, wider than the frame at this zoom, so framing it cuts
// off the left edge and with it the name the viewer is supposed to read.
const TAAK_CEL = `[role="gridcell"]:has-text("${TAAK_NAAM}")`;
// Every side panel in the app is one SideModal, so this one selector is the
// create panel while that is open and the task-details panel later. The dialog
// element covers the whole viewport, and since a focus box only supplies the
// camera a centre point, aiming at it points the camera at the middle of the
// page. Its two children are the full-viewport overlay and then the panel, and
// it is the second one, sized by SideModal's own h-[85vh]
// w-[clamp(400px,40vw,720px)]. Structural rather than semantic, because the
// panel carries only utility classes and no test id.
//
// Beats inside the panel aim at this rather than at their own field: the fields
// sit at the page's right edge, so at camera.maxScale the frame cut the panel
// off. The panel is 803 stage pixels tall against the 794 the camera shows at
// 1.36, so a few pixels still go, evenly at top and bottom instead of lopped
// off one side.
const TAAK_PANEEL = '[role="dialog"] > div:nth-child(2)';

export async function setup({ page, run }) {
  await run.login({ company: COMPANY_NAAM });
  // The task goes to a colleague, so "Mijn taken" never shows it. The scope is
  // a saved per-user preference; switch it to the office-wide list off camera.
  const home = page.url();
  await page.goto('/tasks');
  const scope = page.locator('[data-testid="list-view-switcher-toggle"]');
  await scope.waitFor({ state: 'visible', timeout: 30_000 });
  if ((await scope.innerText()).trim() !== 'Taken') {
    await scope.click();
    await page.getByRole('menuitem', { name: 'Taken', exact: true }).or(page.locator('text="Taken"').last()).first().click();
    await page.waitForTimeout(1500);
  }
  await page.goto(home);
  // The dashboard resolves its route before it paints its widgets, so without
  // this the first beat films an empty window: measured, the plus button is not
  // in the DOM until seconds after /dashboard has loaded.
  await page.locator(NIEUWE_TAAK).waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('button[aria-label="Widgetacties"]').first().waitFor({
    state: 'visible',
    timeout: 30_000,
  });
  // The charts animate in after they mount. Nothing to wait for in the DOM, so
  // this is a settle, deliberately generous: it happens once, before the clock
  // that matters starts.
  await page.waitForTimeout(2500);
}

export const beats = [
  {
    id: 'intro',
    narration:
      'Naast de vaste flows kun je in Flowkeeper ook losse taken bijhouden. Dat kan meteen vanaf je dashboard.',
    speech:
      'Naast de vaste flows kun je in Flowkeeper ook losse taken bijhouden. Dat kan meteen vanaf je dashboard.',
  },
  {
    id: 'kaart-start',
    kind: 'card',
    // Tim's bumpers of 2026-10-02 replace the deadlines card.
    cardDesign: 'balken',
    cardTitle: 'Een losse taak aanmaken',
    cardSubtitle: 'Wat je vastlegt, aan wie je hem geeft, en wanneer hij af moet.',
    cardStep: 1,
  },
  {
    id: 'nieuwe-taak',
    narration:
      'Rechtsonder staat op elk scherm een plus. Daarmee maak je een taak aan, waar je ook bent.',
    speech:
      'Rechtsonder staat op elk scherm een plus. Daarmee maak je een taak aan, waar je ook bent.',
    action: ({ run }) => run.click(NIEUWE_TAAK, 'Nieuwe taak'),
    focus: NIEUWE_TAAK,
    // Let the camera reach the plus before it is pressed, otherwise the panel
    // is already open by the time the viewer is told to click.
    preRollSec: 2.4,
    // The panel slides in after the click; leaving early films it half open.
    minSec: 6.5,
  },
  {
    id: 'naam',
    narration: 'Geef de taak een duidelijke naam. Dit is het enige veld dat verplicht is.',
    speech: 'Geef de taak ’n duidelijke naam. Dit is het énige veld dat verplicht is.',
    action: ({ run }) => run.fill(NAAM, TAAK_NAAM, 'Naam'),
    focus: NAAM,
  },
  {
    id: 'toelichting',
    narration:
      'In de toelichting zet je extra context, zodat degene die de taak oppakt meteen weet wat er moet gebeuren.',
    action: ({ run }) =>
      run.fill(TOELICHTING, 'Cijfers Q3 langslopen en de afwijkingen bespreken.', 'Toelichting'),
    focus: TAAK_PANEEL,
  },
  {
    id: 'toewijzen',
    narration: 'De taak staat standaard op jouw naam. Hier geef je hem aan een collega.',
    speech: 'De taak staat standaard op jouw naam. Hier geef je hem aan ’n collega.',
    // Open the list, hold it long enough to read, then pick someone. The beat
    // used to only point at the closed field while the voice described handing
    // the task over, so it promised something that never happened on screen.
    action: async ({ page, run }) => {
      await run.click(TOEGEWEZEN, 'Toegewezen aan');
      await page.locator(COLLEGA).first().waitFor({ state: 'visible', timeout: 10_000 });
      await page.waitForTimeout(1600);
      await run.click(COLLEGA, COLLEGA_NAAM);
    },
    focus: TOEGEWEZEN,
    // The camera has to read this box BEFORE the action, because picking a
    // colleague renames the field and the selector stops matching. That is what
    // preRollSec is for, and leaving it off cost a recording: boundingBox sat
    // waiting 30s for a button that now said Emma Jansen.
    preRollSec: 1.2,
    minSec: 6.5,
  },
  {
    id: 'aanmaken',
    narration: 'Klik op Taak aanmaken om hem op te slaan.',
    action: ({ run }) => run.click(AANMAKEN, 'Taak aanmaken'),
    // On the button itself, and no minSec: the panel closes on the click, so a
    // longer hold only filmed an empty dashboard.
    focus: AANMAKEN,
    preRollSec: 1.6,
  },
  {
    id: 'kaart-klaar',
    kind: 'card',
    // The stepper shows chapter 1 done and this one active.
    cardDesign: 'stappen',
    cardTitle: 'Staat in je lijst',
    cardSubtitle: 'De taak telt meteen mee in je overzicht en in dat van je collega.',
    cardStep: 2,
  },
  {
    id: 'naar-takenlijst',
    narration: 'De taak staat nu in de takenlijst van het kantoor, tussen het andere werk.',
    // Wide on purpose: the viewer has just been away from the app on a card, so
    // the whole window comes back before anything moves. Then the pointer
    // travels to the sidebar and opens the list.
    wide: true,
    action: async ({ page, run }) => {
      await run.click(TAKEN_NAV, 'Taken');
      await page.waitForURL(/\/tasks/, { timeout: 20_000 });
      // The grid renders after the route resolves, so the row has to be waited
      // for or the next beat reads a focus box that is not there yet.
      await page.locator(TAAK_CEL).first().waitFor({ state: 'visible', timeout: 20_000 });
      await page.waitForTimeout(800);
    },
    minSec: 6.5,
  },
  {
    id: 'taak-openen',
    narration:
      'Klik erop om alles te zien wat erbij hoort, van de werkinstructies tot de updates.',
    speech:
      'Klik erop om alles te zien wat erbij hoort, van de werkinstructies tot de updates.',
    action: async ({ page, run }) => {
      await run.click(TAAK_CEL, 'De taak');
      // .first() because the dialog has two direct children and strict mode
      // refuses an ambiguous locator. runStoryboard already narrows the focus
      // the same way, so the camera and the wait agree on which one.
      await page.locator(TAAK_PANEEL).first().waitFor({ state: 'visible', timeout: 20_000 });
      await page.waitForTimeout(800);
    },
    // Wide: zoomed in, the panel at the right edge was cut off. At the 1680
    // recording width the whole window is readable.
    wide: true,
    minSec: 7.0,
  },
];
