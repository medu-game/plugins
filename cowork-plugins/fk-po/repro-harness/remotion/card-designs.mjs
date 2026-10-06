// Card design names in plain JS, so narrate.mjs and the storyboard validator
// read the same list the composition renders.
export const BUMPER_DESIGNS = ['balken', 'stappen', 'stromen'];
export const CARD_DESIGNS = ['flows', 'clienten', 'deadlines', ...BUMPER_DESIGNS];
// How long a card of each design holds at least. Each ends with its own exit on
// an empty ground, so a shorter card cuts away mid-exit. A design not listed
// falls back to narrate's CARD_MIN_SEC.
export const DESIGN_MIN_SEC = {
  balken: 4.0,
  stappen: 4.0,
  stromen: 4.0,
  flows: 5.0,
  clienten: 5.0,
};
