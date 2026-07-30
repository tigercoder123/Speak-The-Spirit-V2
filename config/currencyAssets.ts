// Shared currency/item icon manifest. Cucumbers are both a battle reward
// (see components/battle/DebriefCucumberGift.tsx) and shop currency
// (components/BasecampShop.tsx) - keeping the icon keyed here, not inlined as
// a path in either place, means both pull from one source if either adopts
// the image instead of the 🥒 emoji.
export const CURRENCY_ASSETS = {
  cucumber: '/Cucumber.png',
} as const;
