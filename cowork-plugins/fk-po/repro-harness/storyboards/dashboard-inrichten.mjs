// Help video 1 van 2 over het dashboard: je eigen dashboard inrichten.
// De tweede video gaat over het gebruiken ervan (Persoon-filter en doorklikken
// via het zijpaneel naar een flow en een taak), de derde over de grafiektypes.
//
// Selectors zijn uit de frontend-broncode gelezen (origin/master), niet gegokt.
// Narratie is Nederlands en zonder em-streepjes (FE-COPY-1).
export const meta = {
  slug: 'dashboard-inrichten',
  title: 'Je eigen dashboard inrichten',
  subtitle: 'Een dashboard dat alleen jij ziet, met de grafieken die jij nodig hebt.',
  account: 'help',
};

const DASHBOARD_NAAM = process.env.FK_HELP_DASHBOARD_NAAM || 'Mijn focus';
const WIDGET_NAAM = 'Mijn flows per status';
const COMPANY_NAAM = process.env.FK_HELP_COMPANY_NAME || undefined;

// Het slotje op het gedeelde tabblad is een icoon met een eigen label, dus dat
// is de enige echt semantische houvast op dat tabblad.
const GEDEELD_SLOT = 'span[role="img"][aria-label^="Gedeeld dashboard"]';
// De plusknop is een dropdown-toggle met verborgen tekst voor schermlezers.
const PLUS_DASHBOARD = 'button:has-text("Dashboard toevoegen")';
const ITEM_PERSOONLIJK = 'text="Nieuw persoonlijk dashboard"';
// Het modaal is het enige met een label Naam op dat moment; nth=-1 pakt het
// laatste veld, zodat een later veld op de achtergrond nooit wint.
const MODAL_NAAM = 'div:has(> label:text-is("Naam")) input >> nth=-1';
const AANMAKEN = 'button:has-text("Aanmaken")';
// Een tabblad is een NavLink, dus een anchor naar /dashboard/<ulid>, geen knop.
// De probe liep hierop vast terwijl het dashboard wel degelijk was aangemaakt,
// en de controle vooraf in setup gebruikte dezelfde verkeerde selector, dus die
// zou een dubbele naam ook nooit hebben gezien.
const NIEUW_TABBLAD = `a[href^="/dashboard/"]:has-text("${DASHBOARD_NAAM}")`;

// De knop in de werkbalk heet hetzelfde als de opslaanknop in het modaal. Op
// het moment van klikken staat het modaal nog dicht, dus nth=0 is de werkbalk.
const WIDGET_TOEVOEGEN = 'button:has-text("Widget toevoegen") >> nth=0';
const ITEM_GRAFIEK = 'text="Grafiek toevoegen"';
const MODAL = '[data-testid="add-widget-modal"]';
// De keuzelijst toont zijn huidige waarde op de knop, en die begint op
// Staafdiagram. Daarna heet de knop anders, dus deze selector werkt alleen
// voordat er gekozen is.
const STIJL_KNOP = `${MODAL} button:has-text("Staafdiagram")`;
const optie = (naam) => `[role="option"]:has-text("${naam}")`;
const WIDGET_NAAM_VELD = `${MODAL} div:has(> label:text-is("Naam")) input`;
const MODAL_OPSLAAN = `${MODAL} button:has-text("Widget toevoegen")`;
const NIEUWE_WIDGET = `[data-testid="widget-card"]:has-text("${WIDGET_NAAM}")`;

export async function setup({ page, run }) {
  await run.login({ company: COMPANY_NAAM });

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.locator(GEDEELD_SLOT).first().waitFor({ state: 'visible', timeout: 30_000 });
  // De grafieken komen seconden na de route binnen en animeren daarna nog. De
  // eerste beat filmt anders een half leeg scherm.
  await page.locator('[data-testid="widget-card"]').first().waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(3000);

  // De opname maakt een echt dashboard aan op het help-account. Draait hij twee
  // keer, dan staan er straks twee tabbladen met dezelfde naam en filmt de
  // slotbeat de verkeerde. Liever hier stoppen met een leesbare melding.
  if (await page.locator(NIEUW_TABBLAD).count()) {
    throw new Error(
      `Er bestaat al een dashboard met de naam "${DASHBOARD_NAAM}" op dit account. ` +
        'Verwijder dat tabblad eerst via Dashboardacties, of draai met ' +
        'FK_HELP_DASHBOARD_NAAM="<andere naam>".'
    );
  }
}

export const beats = [
  {
    id: 'intro',
    narration:
      'Op je dashboard zie je in een oogopslag hoe het werk ervoor staat. Je kunt meerdere dashboards naast elkaar hebben, en zelf bepalen wat erop staat.',
    speech:
      'Op je dashboard zie je in één oogopslag hoe het werk ervoor staat. Je kunt meerdere dashboards naast elkaar hebben, en zélf bepalen wat erop staat.',
  },
  {
    id: 'kaart-start',
    kind: 'card',
    cardDesign: 'flows',
    cardTitle: 'Je eigen dashboard',
    cardSubtitle: 'Naast het gedeelde overzicht van je organisatie.',
    cardStep: 1,
  },
  {
    id: 'gedeeld',
    narration:
      'Dit tabblad heeft een slotje. Dat betekent dat het dashboard gedeeld is: iedereen in je organisatie ziet dezelfde grafieken, en alleen een beheerder past ze aan.',
    focus: GEDEELD_SLOT,
    minSec: 10.0,
  },
  {
    id: 'nieuw-dashboard',
    narration: 'Met het plusje maak je er zelf een. Kies Nieuw persoonlijk dashboard.',
    action: async ({ page, run }) => {
      await run.click(PLUS_DASHBOARD, 'Dashboard toevoegen');
      await page.locator(ITEM_PERSOONLIJK).first().waitFor({ state: 'visible', timeout: 10_000 });
      await page.waitForTimeout(1400);
      await run.click(ITEM_PERSOONLIJK, 'Nieuw persoonlijk dashboard');
      await page.locator(MODAL_NAAM).first().waitFor({ state: 'visible', timeout: 15_000 });
    },
    focus: PLUS_DASHBOARD,
    preRollSec: 1.8,
    minSec: 9.0,
  },
  {
    id: 'naam',
    narration: 'Geef het een naam en klik op Aanmaken. Dit dashboard ziet alleen jij.',
    action: async ({ page, run }) => {
      await run.fill(MODAL_NAAM, DASHBOARD_NAAM, 'Naam');
      await page.waitForTimeout(900);
      await run.click(AANMAKEN, 'Aanmaken');
      await page.locator(NIEUW_TABBLAD).first().waitFor({ state: 'visible', timeout: 20_000 });
    },
    focus: MODAL_NAAM,
    preRollSec: 1.0,
    minSec: 9.0,
  },
  {
    id: 'kaart-grafiek',
    kind: 'card',
    cardDesign: 'deadlines',
    cardEyebrow: 'De grafieken',
    cardTitle: 'Zelf samenstellen',
    cardSubtitle: 'Kies een type, een naam en waarop de grafiek groepeert.',
    cardStep: 2,
  },
  {
    id: 'widget-toevoegen',
    narration: 'Je nieuwe dashboard is nog leeg. Met Widget toevoegen zet je er een grafiek op.',
    action: async ({ page, run }) => {
      await run.click(WIDGET_TOEVOEGEN, 'Widget toevoegen');
      await page.locator(ITEM_GRAFIEK).first().waitFor({ state: 'visible', timeout: 10_000 });
      await page.waitForTimeout(1200);
      await run.click(ITEM_GRAFIEK, 'Grafiek toevoegen');
      await page.locator(MODAL).first().waitFor({ state: 'visible', timeout: 20_000 });
      await page.waitForTimeout(1500);
    },
    focus: WIDGET_TOEVOEGEN,
    preRollSec: 1.8,
    minSec: 9.0,
  },
  {
    id: 'stijl',
    narration:
      'Links zie je meteen hoe de grafiek eruit komt te zien. Bij Grafiekstijl kies je het type: een staafdiagram, een gestapeld staafdiagram, een cirkeldiagram of een voltooiingspercentage.',
    action: async ({ page, run }) => {
      await run.click(STIJL_KNOP, 'Grafiekstijl');
      await page.locator(optie('Cirkeldiagram')).first().waitFor({ state: 'visible', timeout: 10_000 });
      // Even laten staan: de vier opties zijn hier het onderwerp, niet de klik.
      await page.waitForTimeout(2600);
      await run.click(optie('Cirkeldiagram'), 'Cirkeldiagram');
      await page.waitForTimeout(1200);
    },
    focus: STIJL_KNOP,
    preRollSec: 1.2,
    minSec: 14.0,
  },
  {
    id: 'details',
    narration: 'Daaronder geef je de grafiek een naam, en bepaal je waarop hij groepeert.',
    action: async ({ page, run }) => {
      await run.fill(WIDGET_NAAM_VELD, WIDGET_NAAM, 'Naam van de grafiek');
      await page.waitForTimeout(1200);
    },
    focus: WIDGET_NAAM_VELD,
    minSec: 9.0,
  },
  {
    id: 'opslaan',
    narration: 'Klik op Widget toevoegen.',
    action: async ({ page, run }) => {
      await run.click(MODAL_OPSLAAN, 'Widget toevoegen');
      await page.locator(NIEUWE_WIDGET).first().waitFor({ state: 'visible', timeout: 25_000 });
      await page.waitForTimeout(1200);
    },
    focus: MODAL_OPSLAAN,
    preRollSec: 2.0,
    minSec: 6.0,
  },
  {
    id: 'klaar',
    narration:
      'De grafiek staat nu op je eigen dashboard. Je kunt er zoveel toevoegen als je wilt, en ze slepen in de volgorde die jou past.',
    focus: NIEUWE_WIDGET,
    minSec: 10.0,
  },
];
