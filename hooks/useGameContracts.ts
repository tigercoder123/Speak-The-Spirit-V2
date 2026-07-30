'use client';

import { useGame } from '../context/GameContext';
import { addLog } from '../utils/gameEvents';

export function useGameContracts() {
  const { setCupcakes, setHasHolyWater, setTickets } = useGame();

  const rescueSongbeastOnChain = async (beastId: string, decryptionProof: string): Promise<{ success: boolean, txHash?: string, error?: Error | string }> => {
    addLog(`Initiating rescue process for beast ${beastId}...`, "system");
    
    return new Promise((resolve) => {
      setTimeout(() => {
        addLog(`Verified: Proof ${decryptionProof.slice(0,8)}... accepted.`, "system");
        addLog(`Rescue successful! Spirit Beast Ribbon awarded.`, "songbeast");
        setCupcakes(prev => prev + 10); 
        resolve({ success: true });
      }, 1500);
    });
  };

  const purchaseItemOnChain = async (itemId: string, costInCupcakes: number): Promise<{ success: boolean, txHash?: string, error?: Error | string }> => {
    addLog(`Processing purchase of ${itemId}...`, "system");

    return new Promise((resolve) => {
      setTimeout(() => {
        addLog(`Purchase Confirmed: Spent ${costInCupcakes} Cupcakes.`, "shop");
        if (itemId === 'WATER') setHasHolyWater(true);
        if (itemId === 'TICKET') setTickets(prev => prev + 1);
        addLog(`Received ${itemId} in inventory!`, "system");
        resolve({ success: true });
      }, 1000);
    });
  };

  return { rescueSongbeastOnChain, purchaseItemOnChain };
}
