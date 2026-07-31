'use client';

import React from 'react';
import { useGame } from '../context/GameContext';
import { addLog } from '../utils/gameEvents';
import { useGameContracts } from '../hooks/useGameContracts';
import { SHOP_ITEMS, TRADING_POST_DESCRIPTION } from '../config/shopConfig';
import { POWER_UPS, type PowerUpType } from '../config/powerUpConfig';
import Tooltip from './Tooltip';

/**
 * BasecampShop
 * ------------
 * Presentational overlay for the hand-painted shop.jpg background. The
 * background is a fixed painting; every interactive element is positioned
 * in % so the overlay stays locked to the painted card slots at any width.
 * Persistence/logic lives in GameContext + useGameContracts, not here - this
 * component only reads state and calls the setters/purchase mock.
 */

type PurchasableId = PowerUpType | 'HOLY_WATER';

interface SlotPosition {
  leftPct: number;
  topPct: number;
  widthPct: number;
}

// Slot coordinates are tuned to shop.jpg's painted card frames. If the art
// is regenerated, nudge these %s to match the new frame positions.
const SLOT_POSITIONS: Record<PurchasableId, SlotPosition> = {
  // ---- Top row (three cards) ----
  HINT: { leftPct: 32.5, topPct: 40.5, widthPct: 11.5 },
  HUSH_SILENCER: { leftPct: 45.2, topPct: 40.5, widthPct: 11.5 },
  FREE_PASS: { leftPct: 57.6, topPct: 40.5, widthPct: 11.5 },
  // ---- Bottom row (three cards) ----
  SHIELD: { leftPct: 32.5, topPct: 76, widthPct: 11.5 },
  CHECK: { leftPct: 45.2, topPct: 76, widthPct: 11.5 },
  HOLY_WATER: { leftPct: 57.5, topPct: 74.5, widthPct: 11.5 },
};

interface Slot {
  id: PurchasableId;
  name: string;
  description: string;
  cost: number;
  isPowerUp: boolean; // false = Holy Water (owned/one-time), true = counted power-up
  position: SlotPosition;
}

const waterItem = SHOP_ITEMS.find((item) => item.id === 'WATER')!;

const SLOTS: Slot[] = [
  ...POWER_UPS.map((p): Slot => ({
    id: p.id,
    name: p.name,
    description: p.description,
    cost: p.cost,
    isPowerUp: true,
    position: SLOT_POSITIONS[p.id],
  })),
  {
    id: 'HOLY_WATER',
    name: waterItem.name,
    description: waterItem.description,
    cost: waterItem.cost,
    isPowerUp: false,
    position: SLOT_POSITIONS.HOLY_WATER,
  },
];

export default function BasecampShop() {
  const {
    cupcakes,
    setCupcakes,
    cucumbers,
    setCucumbers,
    hasHolyWater,
    powerUps,
    setCurrentScreen,
    feedback,
    setFeedback,
    triggerShake,
    shakeTrigger,
  } = useGame();

  const { purchaseItemOnChain } = useGameContracts();

  const canAfford = (cost: number) => cupcakes >= cost;
  const isOwned = (slot: Slot) => !slot.isPowerUp && hasHolyWater;

  const handleBuy = async (slot: Slot) => {
    if (isOwned(slot)) return;
    if (!canAfford(slot.cost)) {
      triggerShake();
      setFeedback(`Insufficient Cupcakes for ${slot.name}! Go clear Faith Island or sell Cucumbers!`);
      return;
    }
    setCupcakes(cupcakes - slot.cost);
    // Holy Water's real shop id is 'WATER' (see config/shopConfig.ts) - 'HOLY_WATER'
    // above is only this overlay's own slot key, not what purchaseItemOnChain expects.
    const purchaseId = slot.isPowerUp ? slot.id : waterItem.id;
    await purchaseItemOnChain(purchaseId, slot.cost);
    setFeedback(`Successfully purchased ${slot.name}!`);
  };

  const handleTrade = () => {
    if (cucumbers < 1) {
      triggerShake();
      setFeedback('No Cucumbers in stock to trade!');
      return;
    }
    setCucumbers(cucumbers - 1);
    setCupcakes(cupcakes + 2);
    addLog('Sold 1 Cucumber for +2 Cupcakes at the Trading Post.', 'shop');
    setFeedback('Traded 1 Cucumber for 2 Cupcakes!');
  };

  const handleReturn = () => {
    setCurrentScreen('OVERWORLD');
    setFeedback('');
  };

  return (
    <div className="flex-1 flex flex-col">
      <div style={styles.frame} className={shakeTrigger ? 'animate-shake-box' : ''}>
        <img src="/shop.jpg" alt="Basecamp shop" style={styles.bg} />

        {/* ---- Currency plaques (top-left banner) ---- */}
        <div style={pos(7, 8.5, 8)}>
          <span style={styles.currencyNum}>{cucumbers}</span>
        </div>
        <div style={pos(22, 8.1, 8)}>
          <span style={styles.currencyNum}>{cupcakes}</span>
        </div>

        {/* ---- Return to Map (top-right blank plaque) ---- */}
        <button onClick={handleReturn} style={{ ...pos(91.5, 3.5, 6, 8), ...styles.mapBtn }}>
          🗺️ Return to Map
        </button>

        {/* ---- Item cards ---- */}
        {SLOTS.map((slot) => {
          const owned = isOwned(slot);
          const affordable = canAfford(slot.cost);
          const disabled = owned || !affordable;
          const count = slot.isPowerUp ? powerUps[slot.id as PowerUpType] : null;
          return (
            <div key={slot.id} style={pos(slot.position.leftPct, slot.position.topPct, slot.position.widthPct)}>
              <div style={styles.cardName}>
                {slot.id === 'HOLY_WATER' ? (
                  <>
                    Holy Water
                    <br />
                    Spray
                  </>
                ) : (
                  slot.name
                )}
              </div>
              <div style={styles.cardMeta}>
                {owned ? (
                  <span style={styles.owned}>Owned</span>
                ) : (
                  <span style={styles.cost}>{slot.cost} 🧁</span>
                )}
                {count !== null && <span style={styles.have}>×{count}</span>}
              </div>
              <span className="shop-tooltip-wrap">
                <button
                  onClick={() => handleBuy(slot)}
                  disabled={disabled}
                  aria-describedby={`tooltip-${slot.id}`}
                  style={{ ...styles.buyBtn, ...(disabled ? styles.buyBtnDisabled : {}) }}
                >
                  {owned ? 'Owned' : 'Buy'}
                </button>
                <Tooltip id={`tooltip-${slot.id}`} text={slot.description} />
              </span>
            </div>
          );
        })}

        {/* ---- Trading Post (highlighted seal, bottom-right) - title, the
            1->2 conversion line, and the Sell button are each their own
            independently-positioned element now, not one stacked group. ---- */}
        <div style={pos(70.5, 65, 16)}>
          <span style={styles.tradeName}>Trading Post</span>
        </div>
        <div style={pos(70.7, 69.5, 16)}>
          <span style={styles.tradeSub}>1 🥒 → 2 🧁</span>
        </div>
        <span className="shop-tooltip-wrap" style={pos(73.5, 75, 10)}>
          <button
            onClick={handleTrade}
            disabled={cucumbers < 1}
            aria-describedby="tooltip-trading-post"
            style={{ ...styles.tradeBtn, ...(cucumbers < 1 ? styles.buyBtnDisabled : {}) }}
          >
            Sell 🥒
          </button>
          <Tooltip id="tooltip-trading-post" text={TRADING_POST_DESCRIPTION} />
        </span>
      </div>

      <div className="mt-3 flex justify-between items-center text-xs">
        <span className="text-pink-400 font-bold min-h-[1em]">{feedback}</span>
        <span className="text-slate-500 font-bold animate-pulse">{'Items synced with database!'}</span>
      </div>
    </div>
  );
}

// % positioning helper: anchors an absolutely-positioned box to the painting.
function pos(leftPct: number, topPct: number, widthPct: number, heightPct?: number): React.CSSProperties {
  return {
    position: 'absolute',
    left: `${leftPct}%`,
    top: `${topPct}%`,
    width: `${widthPct}%`,
    ...(heightPct ? { height: `${heightPct}%` } : {}),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.35vw',
  };
}

const styles: Record<string, React.CSSProperties> = {
  frame: {
    position: 'relative',
    width: '100%',
    maxWidth: 1366,
    margin: '0 auto',
    aspectRatio: '16 / 9',
    fontFamily: '"Georgia", "Times New Roman", serif',
    userSelect: 'none',
    borderRadius: '1rem',
    overflow: 'hidden',
    border: '4px solid #000',
    boxShadow: '6px 6px 0px 0px #000',
  },
  bg: {
    width: '100%',
    height: '100%',
    display: 'block',
    objectFit: 'cover',
    pointerEvents: 'none',
  },
  currencyNum: {
    color: '#3a2a12',
    fontWeight: 800,
    fontSize: 'clamp(12px, 1.6vw, 24px)',
    textShadow: '0 1px 0 rgba(255,255,255,0.35)',
  },
  mapBtn: {
    justifyContent: 'center',
    background: 'rgba(60,40,20,0.0)',
    color: '#4a3411',
    fontWeight: 800,
    fontSize: 'clamp(9px, 1.05vw, 16px)',
    border: 'none',
    cursor: 'pointer',
    textShadow: '0 1px 0 rgba(255,255,255,0.4)',
  },
  cardName: {
    color: '#4a3411',
    fontWeight: 800,
    fontSize: 'clamp(9px, 1.05vw, 17px)',
    lineHeight: 1.05,
    textAlign: 'center',
    textShadow: '0 1px 0 rgba(255,248,225,0.5)',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4vw',
    color: '#5c4420',
    fontSize: 'clamp(8px, 0.95vw, 15px)',
    fontWeight: 700,
  },
  cost: { color: '#7a4a12' },
  have: {
    color: '#3d6b2e',
    background: 'rgba(255,255,255,0.35)',
    borderRadius: 6,
    padding: '0 0.3vw',
  },
  owned: { color: '#3d6b2e', fontWeight: 800 },
  buyBtn: {
    marginTop: '0.15vw',
    padding: '0.3vw 1vw',
    borderRadius: 8,
    border: '2px solid #5b3d16',
    background: 'linear-gradient(#f6c453,#e0972f)',
    color: '#3a2408',
    fontWeight: 900,
    fontSize: 'clamp(9px, 1vw, 15px)',
    cursor: 'pointer',
    boxShadow: '0 2px 0 #5b3d16',
    lineHeight: 1,
  },
  buyBtnDisabled: {
    background: 'linear-gradient(#c9bfae,#a99f8d)',
    color: '#6e6656',
    borderColor: '#8a8272',
    boxShadow: '0 2px 0 #8a8272',
    cursor: 'not-allowed',
    opacity: 0.85,
  },
  tradeName: {
    color: '#3f2e12',
    fontWeight: 900,
    fontSize: 'clamp(9px, 1.05vw, 17px)',
    textAlign: 'center',
  },
  tradeSub: {
    color: '#5c4420',
    fontWeight: 700,
    fontSize: 'clamp(8px, 0.95vw, 14px)',
  },
  tradeBtn: {
    marginTop: '0.15vw',
    padding: '0.3vw 1vw',
    borderRadius: 8,
    border: '2px solid #2f5a24',
    background: 'linear-gradient(#7bd06a,#46a636)',
    color: '#14350c',
    fontWeight: 900,
    fontSize: 'clamp(9px, 1vw, 15px)',
    cursor: 'pointer',
    boxShadow: '0 2px 0 #2f5a24',
    lineHeight: 1,
  },
};
