// Help video 2 van 2 over het dashboard: je dashboard gebruiken.
// Video 1 ging over het inrichten, de derde gaat over de grafiektypes zelf.
//
// Deze video leest alleen; hij maakt en wijzigt niets op het account. De
// Persoon-filter wordt aan het eind weer leeggemaakt zodat het dashboard
// achterblijft zoals het was.
export const meta = {
  slug: 'dashboard-gebruiken',
  title: 'Je dashboard gebruiken',
  subtitle: 'Filter op een collega, en klik door van een grafiek naar de flows en taken erachter.',
  account: 'help',
};

const COMPANY_NAAM = process.env.FK_HELP_COMPANY_NAME || undefined;
const COLLEGA = process.env.FK_HELP_COLLEAGUE_NAME || 'Bram Peters';
// De klant en de taak komen uit de demo-data van het help-account. Gekozen op
// een flow waar daadwerkelijk in gewerkt is: twee van de zeven taken staan op
// afgerond, dus het paneel toont voortgang in plaats van een lege lijst.
const KLANT = 'Jansen & Partners VOF';
const TAAK = 'Voorzieningen beoordelen';

const KAART_STATUS = '[data-testid="widget-card"]:has-text("Flows per status")';
// De staven komen uit de grafiekbibliotheek en hebben geen eigen testhaakje. De
// app zet zelf cursor-pointer op een staaf die iets te tonen heeft: een staaf
// met waarde nul is niet klikbaar. Gemeten in de draaiende app, niet gegokt.
const STAAF_BEZIG = `${KAART_STATUS} [data-testid="widget-chart"] path.recharts-rectangle >> nth=0`;
// De persoonfilter heeft eigen testhaakjes, en elke persoon draagt zijn volle
// naam als label. De lijst zelf toont alleen initialen in bolletjes, dus zoeken
// op de naam in beeld werkt niet: die staat er nergens.
// nth=0 is de filter boven het dashboard; het zijpaneel heeft er later nog een.
const PERSOON_KNOP = '[data-testid="person-filter-toggle"] >> nth=0';
const persoonOptie = (naam) => `[data-testid="person-filter-option"][aria-label="${naam}"]`;
const PANEEL = '[role="dialog"]';
// Het zijpaneel is een SideModal: het eerste kind is de overlay over het hele
// scherm, het tweede is het paneel zelf. Richten op de dialog zet de camera in
// het midden van de pagina in plaats van op het paneel.
const PANEEL_ZELF = '[role="dialog"] > div:nth-child(2)';
const FLOW_RIJ = `[role="dialog"] [role="button"]:has-text("${KLANT}")`;
// Bewust een afgeronde taak en niet simpelweg de eerste: de eerste staat op Te
// starten en heeft dus niets te melden, terwijl deze video juist over het werk
// erachter gaat. Deze taak is afgerond, dus de sectie Updates heeft inhoud.
const TAAK_KNOP = `button[aria-label="Taak ${TAAK} openen"]`;
const UPDATES_SECTIE = 'button:has-text("Updates")';
const WIS_FILTER = 'button:has-text("Alles wissen")';

export async function setup({ page, run }) {
  await run.login({ company: COMPANY_NAAM });
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.locator(KAART_STATUS).first().waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator(STAAF_BEZIG).first().waitFor({ state: 'visible', timeout: 30_000 });
  // De grafieken animeren in nadat ze gemount zijn; zonder deze settle filmt de
  // eerste beat staven die nog aan het groeien zijn.
  await page.waitForTimeout(3500);
}

export const beats = [
  {
    id: 'intro',
    narration:
      'Je dashboard is meer dan een plaatje. Je kunt het toespitsen op een collega, en vanuit elke grafiek doorklikken naar het werk dat erachter zit.',
    speech:
      'Je dashboard is méér dan een plaatje. Je kunt het toespitsen op een collega, en vanuit elke grafiek doorklikken naar het werk dat erachter zit.',
  },
  {
    id: 'kaart-filter',
    kind: 'card',
    cardDesign: 'clienten',
    cardTitle: 'Filteren op een collega',
    cardSubtitle: 'Alle grafieken tegelijk, met een klik.',
    cardStep: 1,
  },
  {
    id: 'persoon',
    narration:
      'Bovenaan staat de Persoon-filter. Kies je hier een collega, dan rekenen alle grafieken op dit dashboard opnieuw, alleen voor die persoon. Met Alles wissen staat alles weer open.',
    action: async ({ page, run }) => {
      await run.click(PERSOON_KNOP, 'Persoon');
      await page.locator(persoonOptie(COLLEGA)).first().waitFor({ state: 'visible', timeout: 10_000 });
      await page.waitForTimeout(1800);
      await run.click(persoonOptie(COLLEGA), COLLEGA);
      await page.waitForTimeout(2800);
      // Weer uitzetten, om twee redenen. Het laat zien dat het een filter is en
      // geen instelling, en het doorklikken verderop gaat over de hele lijst:
      // met de filter aan bestaat de flow die daar geopend wordt niet meer.
      await run.click(WIS_FILTER, 'Alles wissen');
      await page.waitForTimeout(1800);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1500);
    },
    focus: PERSOON_KNOP,
    preRollSec: 1.6,
    minSec: 16.0,
  },
  {
    id: 'kaart-doorklikken',
    kind: 'card',
    cardDesign: 'flows',
    cardEyebrow: 'Doorklikken',
    cardTitle: 'Van grafiek naar taak',
    cardSubtitle: 'Elke staaf is een ingang naar het werk erachter.',
    cardStep: 2,
  },
  {
    id: 'staaf',
    narration:
      'Klik op een staaf om te zien welke flows erin zitten. Rechts schuift een paneel open met precies die flows.',
    action: async ({ page, run }) => {
      await run.click(STAAF_BEZIG, 'Staaf Bezig');
      await page.locator(PANEEL).first().waitFor({ state: 'visible', timeout: 20_000 });
      await page.waitForTimeout(2000);
    },
    focus: STAAF_BEZIG,
    preRollSec: 2.0,
    minSec: 10.0,
  },
  {
    id: 'paneel',
    narration:
      'Bovenin het paneel staat waar je op klikte en hoeveel flows dat zijn. Ook hier kun je op persoon filteren, maar dan alleen binnen deze lijst.',
    focus: PANEEL_ZELF,
    minSec: 11.0,
  },
  {
    id: 'flow',
    narration:
      'Klik op een flow om te zien hoe het ervoor staat. Je ziet de voortgang, en per taak wie hem heeft en wanneer hij af moet.',
    action: async ({ page, run }) => {
      await run.click(FLOW_RIJ, KLANT);
      await page.locator(TAAK_KNOP).first().waitFor({ state: 'visible', timeout: 20_000 });
      await page.waitForTimeout(2000);
    },
    focus: PANEEL_ZELF,
    preRollSec: 1.8,
    minSec: 12.0,
  },
  {
    id: 'taak',
    narration:
      'En vanuit die lijst open je een taak. Onder Updates staan de reacties op de taak, en laat je er zelf een achter. Zo sta je in een paar klikken bij het werk zelf, zonder je dashboard kwijt te raken.',
    action: async ({ page, run }) => {
      await run.click(TAAK_KNOP, `Taak ${TAAK} openen`);
      await page.locator(UPDATES_SECTIE).first().waitFor({ state: 'visible', timeout: 15_000 });
      await page.waitForTimeout(2200);
      // De demo-seeder maakt geen reacties aan (FK-734); op 2026-10-05 zijn er
      // met de hand twee op deze taak gezet. Een vers geseed account toont hier
      // een lege sectie: zet er eerst reacties op, of wacht op FK-734.
      await run.click(UPDATES_SECTIE, 'Updates');
      await page.waitForTimeout(3000);
    },
    focus: PANEEL_ZELF,
    preRollSec: 1.8,
    minSec: 14.0,
  },
  {
    id: 'slot',
    narration:
      'Sluit je het paneel, dan sta je weer op je dashboard, met je filter nog precies zoals je hem had staan.',
    action: async ({ page }) => {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(2500);
    },
    focus: KAART_STATUS,
    preRollSec: 1.0,
    minSec: 10.0,
  },
];
