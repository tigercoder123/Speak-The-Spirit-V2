'use client';

import React from 'react';
import { useGame } from '../context/GameContext';
import { addLog } from '../utils/gameEvents';
import { useGameContracts } from '../hooks/useGameContracts';
import { SHOP_ITEMS, ShopItem } from '../config/shopConfig';

export default function BasecampShop() {
  const { 
    cupcakes, 
    setCupcakes,
    cucumbers,
    setCucumbers,
    hasHolyWater,
    setCurrentScreen, 
    setFeedback, 
    triggerShake 
  } = useGame();

  const { purchaseItemOnChain } = useGameContracts();

  const executePurchase = async (item: ShopItem) => {
    if (cupcakes >= item.cost) {
      setCupcakes(cupcakes - item.cost);
      await purchaseItemOnChain(item.id, item.cost);
      setFeedback(`Successfully purchased ${item.name}!`);
    } else {
      triggerShake();
      setFeedback(`Insufficient Cupcakes for ${item.name}! Go clear Faith Island or sell Cucumbers!`);
    }
  };

  const executeTrade = () => {
    if (cucumbers >= 1) {
      setCucumbers(cucumbers - 1);
      setCupcakes(cupcakes + 2);
      addLog("Sold 1 Cucumber for +2 Cupcakes at the Trading Post.", "shop");
      setFeedback("Traded 1 Cucumber for 2 Cupcakes!");
    } else {
      triggerShake();
      setFeedback("No Cucumbers in stock to trade!");
    }
  };

  const isItemOwned = (item: ShopItem) => {
    if (!item.stateKey) return false;
    if (item.stateKey === 'hasHolyWater') return hasHolyWater;
    return false;
  };

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center border-b-2 border-slate-700 pb-3 mb-4">
          <span className="text-pink-400 font-black tracking-widest uppercase text-xs">Phase 2b: Basecamp & Shop</span>
          <button 
            onClick={() => {
              setCurrentScreen('OVERWORLD');
              setFeedback('');
            }} 
            className="bg-slate-700 hover:bg-slate-600 text-white px-2.5 py-1 text-xs font-bold rounded border border-black neo-btn"
          >
            🗺️ Return to Map
          </button>
        </div>

        <div className="flex items-center gap-4 bg-slate-900 p-4 border-4 border-black rounded-xl mb-6 shadow-[3px_3px_0px_#000]">
          <div className="w-12 h-12 rounded-full bg-pink-400 border-2 border-black flex items-center justify-center text-2xl shrink-0">💂</div>
          <div>
            <p className="text-pink-400 font-bold text-xs uppercase">Basecamp Armory & Supplies</p>
            <p className="text-sm italic text-slate-200 mt-1">
              {"Welcome, Messenger! Trade your earned sweets for survival items. Got some Cucumbers? I'll buy them too!"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SHOP_ITEMS.map((item) => {
            const owned = isItemOwned(item);
            return (
              <div key={item.id} className="bg-slate-900 p-4 border-3 border-black rounded-xl flex items-center justify-between shadow-[2px_2px_0px_#000]">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{item.icon}</span>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-100">{item.name}</h4>
                    <p className="text-[10px] text-slate-400">{item.description}</p>
                    <span className="text-xs font-black text-pink-400">
                      {owned ? "OWNED" : `Cost: ${item.cost} ${item.costLabel}`}
                    </span>
                  </div>
                </div>
                <button
                  disabled={owned}
                  onClick={() => executePurchase(item)}
                  className={`font-black text-xs px-3 py-2 rounded border-2 border-black ${
                    owned 
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed border-slate-800' 
                      : 'bg-yellow-400 hover:bg-yellow-300 text-black neo-btn'
                  }`}
                >
                  Buy {item.icon}
                </button>
              </div>
            );
          })}

          <div className="bg-slate-950 p-4 border-3 border-dashed border-pink-400 rounded-xl flex items-center justify-between">
            <div>
              <h4 className="font-black text-xs text-pink-400 uppercase tracking-wider">Trading Post</h4>
              <p className="text-[10px] text-slate-300 mt-0.5">Sell 1 Cucumber 🥒 to earn 2 Cupcakes 🧁.</p>
              <span className="text-[10px] font-bold text-slate-500">Inventory: {cucumbers} Cucumbers</span>
            </div>
            <button
              onClick={executeTrade}
              className="bg-green-500 hover:bg-green-400 text-white font-extrabold text-xs px-3 py-2 rounded border-2 border-black neo-btn"
            >
              Sell 🥒
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-3 border-t-2 border-slate-700 flex justify-between items-center text-xs">
        <span className="text-pink-400 font-bold animate-pulse">{"Items synced with database!"}</span>
        <button 
          onClick={() => {
            setCurrentScreen('OVERWORLD');
            setFeedback('');
          }} 
          className="text-slate-400 hover:text-white underline font-semibold"
        >
          Back to Overworld Map
        </button>
      </div>
    </div>
  );
}
