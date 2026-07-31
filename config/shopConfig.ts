export interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: string;
  costLabel: string;
  stateKey: 'hasHolyWater' | null;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'WATER',
    name: 'Holy Water Spray',
    description: "Breaches Love Island's static barrier.",
    cost: 6,
    icon: '🧪',
    costLabel: 'Cupcakes 🧁',
    stateKey: 'hasHolyWater',
  },
];

// Trading Post isn't a purchasable ShopItem (no cost/icon/owned state), just
// a standing conversion feature in the shop - kept here so its tooltip copy
// (see components/BasecampShop.tsx) stays config-driven like everything else.
export const TRADING_POST_DESCRIPTION = 'Trade 1 cucumber for 2 cupcakes.';
