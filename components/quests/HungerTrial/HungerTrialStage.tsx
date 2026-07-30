import React, { useState, useEffect, useRef } from 'react';
// 1. NEW: Import the GameContext hook
import { useGame } from '../../../context/GameContext';
import { usePlayerWalker } from '../../../hooks/usePlayerWalker';
import DirectionalPad from '../../DirectionalPad';

interface HungerTrialStageProps {
  stageState: string;
  characterPath: string;
  onStartWalk: () => void;
  onReachOasis: () => void;
  onActionSelect: (action: 'fishing' | 'fruit') => void;
  onDiscoverChest: () => void; // 👈 New event trigger
  onTransitionToChallenge: () => void;
  selectedAction: 'fishing' | 'fruit' | null;
}

const PLAYER_SPEED = 9;
const MAP_BOUNDS = { minX: 0, maxX: 800, minY: 0, maxY: 600 };
const PATH_TOLERANCE = 45;

export default function HungerTrialStage({
  stageState,
  characterPath,
  onStartWalk,
  onReachOasis,
  onActionSelect,
  onDiscoverChest, //added
  onTransitionToChallenge,
  selectedAction
}: HungerTrialStageProps) {
  // 2. NEW: Grab verseChunks from the context
  const { verseChunks } = useGame();

 const hungerWaypoints = [
    { x: 79, y: 564 }, { x: 156, y: 569 }, { x: 212, y: 522 }, { x: 212, y: 522 }, { x: 152, y: 504 }, { x: 266, y: 470 }, { x: 207, y: 480 }, { x: 199, y: 568 }, { x: 339, y: 491 }, { x: 417, y: 499 }, { x: 478, y: 498 }, { x: 544, y: 497 }, { x: 599, y: 456 }, { x: 574, y: 414 }, { x: 516, y: 371 }, { x: 456, y: 373 }, { x: 372, y: 354 }, { x: 299, y: 346 }, { x: 252, y: 333 }, { x: 233, y: 279 }, { x: 303, y: 275 }, { x: 353, y: 269 }, { x: 431, y: 290 }, { x: 497, y: 296 }, { x: 560, y: 285 }, { x: 569, y: 215 }, { x: 505, y: 200 }, { x: 428, y: 204 }, { x: 366, y: 199 }, { x: 308, y: 186 }, { x: 296, y: 166 }, { x: 360, y: 154 }, { x: 407, y: 142 }, { x: 359, y: 116 }, { x: 395, y: 72 }, { x: 115, y: 520 }
  ];

  // 📍 NEW: Waypoints for the Quarter Rest Oasis map (Trace/Update with Debugger later!)
  const oasisWaypoints = [
    { x: 103, y: 560 }, { x: 165, y: 572 }, { x: 204, y: 565 }, { x: 77, y: 582 }, { x: 131, y: 518 }, { x: 96, y: 527 }, { x: 176, y: 500 }, { x: 206, y: 471 }, { x: 225, y: 530 }, { x: 269, y: 464 }, { x: 334, y: 486 }, { x: 378, y: 489 }, { x: 436, y: 498 }, { x: 487, y: 501 }, { x: 543, y: 494 }, { x: 599, y: 484 }, { x: 616, y: 449 }, { x: 557, y: 454 }
  ];

  // 🎮 UNIVERSAL MINIGAME STATE
  const [minigameStatus, setMinigameStatus] = useState<'playing' | 'won' | 'lost'>('playing');

  // 🎣 FISHING STATE
  const [fishingCursor, setFishingCursor] = useState(0);
  const directionRef = useRef(1); 

  // 🍎 FRUIT STATE (3x3 Grid)
  const [applesCaught, setApplesCaught] = useState(0);
  const [appleIndex, setAppleIndex] = useState<number | null>(null);

  // --------------------------------------------------------
  // 1. DESERT WALK LOGIC
  // --------------------------------------------------------
  const isWalkableStage = stageState === 'desert-walk' || stageState === 'quarter-rest';
  const currentWaypoints = stageState === 'quarter-rest' ? oasisWaypoints : hungerWaypoints;

  const { position: playerPos, facing, setPosition: setPlayerPos, startMove, stopMove } = usePlayerWalker({
    initialPosition: { x: 103, y: 560 },
    speed: PLAYER_SPEED,
    bounds: MAP_BOUNDS,
    path: { waypoints: currentWaypoints, tolerance: PATH_TOLERANCE },
    enabled: isWalkableStage,
  });

  // 🔄 NEW: Reset character positioning when arriving at the Oasis Map layer
  useEffect(() => {
    if (stageState === 'quarter-rest') {
      setPlayerPos({ x: 103, y: 560 });
    }
  }, [stageState, setPlayerPos]);

  useEffect(() => {
    if (stageState === 'desert-walk' && playerPos.y < 120) {
      onReachOasis();
    } else if (stageState === 'quarter-rest') { // 👈 Added hot-spot monitor
      const restX = 580;
      const restY = 467;
      const distanceToRest = Math.sqrt(Math.pow(playerPos.x - restX, 2) + Math.pow(playerPos.y - restY, 2));
      
      if (distanceToRest <= 50) {
        onDiscoverChest();
      }
    }
  }, [playerPos, stageState, onReachOasis, onDiscoverChest]);

  // 💬 DESERT DIALOGUE STATE
  const [bubbleText, setBubbleText] = useState("I'm hungry...");

  // 🔄 PERIODICALLY CHANGE SPEECH BUBBLE TEXT
  useEffect(() => {
    if (stageState !== 'desert-walk') return;

    const phrases = ["I'm hungry...", "Are we there yet?", "So thirsty...", "Is that a mirage?", "My feet hurt..."];
    let index = 0;

    const textInterval = setInterval(() => {
      index = (index + 1) % phrases.length;
      setBubbleText(phrases[index]);
    }, 3000); // Changes text every 3 seconds

    return () => clearInterval(textInterval);
  }, [stageState]);

  // --------------------------------------------------------
  // 2. FISHING LOGIC
  // --------------------------------------------------------
  useEffect(() => {
    if (stageState === 'action-scene' && selectedAction === 'fishing' && minigameStatus === 'playing') {
      const gameLoop = setInterval(() => {
        setFishingCursor((prev) => {
          let next = prev + (directionRef.current * 3); 
          if (next >= 100) { next = 100; directionRef.current = -1; }
          if (next <= 0) { next = 0; directionRef.current = 1; }
          return next;
        });
      }, 30);
      return () => clearInterval(gameLoop);
    }
  }, [stageState, selectedAction, minigameStatus]);

  const attemptCatch = () => {
    if (fishingCursor >= 30 && fishingCursor <= 70) setMinigameStatus('won');
    else setMinigameStatus('lost');
  };


  // --------------------------------------------------------
  // 3. FRUIT LOGIC (3x3 Grid)
  // --------------------------------------------------------
  useEffect(() => {
    if (stageState === 'action-scene' && selectedAction === 'fruit' && minigameStatus === 'playing') {
      const appleTimer = setInterval(() => {
        // Pick a random grid cell from 0 to 8
        setAppleIndex(Math.floor(Math.random() * 9));
      }, 800); // Apples jump around every 0.8 seconds to keep it snappy!
      
      return () => clearInterval(appleTimer);
    }
  }, [stageState, selectedAction, minigameStatus]);

  const handleAppleClick = () => {
    setAppleIndex(null); // Hide it instantly
    const nextCount = applesCaught + 1;
    setApplesCaught(nextCount);
    if (nextCount >= 5) setMinigameStatus('won');
  };


  // --------------------------------------------------------
  // RENDER UI
  // --------------------------------------------------------
  // Determine backgrounds dynamically
  const currentBackground = 
    stageState === 'desert-walk' ? "url('/hunger_path.png')" : 
    stageState === 'quarter-rest' ? "url('/quarter_rest_oasis.png')" : // 👈 Added
    selectedAction === 'fishing' ? "url('/fishing.png')" : "url('/lush_garden.png')";

  return (
    <div className="flex-1 w-full relative overflow-hidden flex flex-col items-center justify-center bg-slate-800 rounded border-4 border-black shadow-[inset_4px_4px_0px_rgba(0,0,0,0.5)]">
      
      {/* RIDDLE INTRO */}
      {stageState === 'riddle-intro' && (
         <div className="m-auto w-full max-w-md bg-amber-50 text-black border-4 border-black p-6 rounded-xl shadow-[6px_6px_0px_#000] text-center relative">
           <h2 className="text-xl font-black uppercase text-amber-900 mt-4 mb-3">The Hunger Trial</h2>
           <div className="bg-white border-2 border-black p-4 rounded-lg italic font-bold text-sm text-slate-800 leading-relaxed mb-6">
             "When your belly grows empty and hunger grows strong,<br />
             Trust in the Gardener and keep moving along."
           </div>
           <button 
             onClick={onStartWalk}
             className="w-full bg-green-500 hover:bg-green-400 text-white font-black py-3 px-6 rounded-lg border-2 border-black shadow-[4px_4px_0px_#000] active:translate-y-1 uppercase"
           >
             Continue walking ➔
           </button>
         </div>
      )}

      {/* DESERT WALK / QUARTER REST MAPS */}
      {(stageState === 'desert-walk' || stageState === 'quarter-rest') && ( // 👈 Unified View Layer
        <div className="w-full h-full flex items-center justify-center bg-slate-950 p-2">
          <div 
            className="relative border-4 border-black shadow-[4px_4px_0px_#000] bg-slate-800 overflow-hidden"
            style={{
              width: '800px', height: '600px',
              backgroundImage: currentBackground,
              backgroundSize: '100% 100%', backgroundPosition: 'center'
            }}
          >
            <div className="absolute top-4 left-4 text-xs font-black text-amber-100 bg-black/70 p-2 rounded border-2 border-amber-500 z-50 shadow-[2px_2px_0px_#000]">
              {stageState === 'desert-walk' ? "Follow the winding path to the horizon ➔" : "Walk onto the hidden Quarter Rest marker! 🔍"}
            </div>

            {/* 🏃‍♂️ CHARACTER */}
            <div 
              className="absolute w-24 h-24 -translate-x-1/2 -translate-y-[80%] transition-all duration-75 ease-out z-20 flex flex-col items-center"
              style={{ left: `${playerPos.x}px`, top: `${playerPos.y}px` }}
            >
              {stageState === 'desert-walk' && (
                <div className="absolute bottom-full mb-2 bg-white text-black text-[10px] font-black px-2 py-1 rounded border-2 border-black shadow-[2px_2px_0px_#000] whitespace-nowrap animate-bounce-short">
                  {bubbleText}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-black" />
                </div>
              )}
              <img src={characterPath} alt="Character" className="w-full h-full object-contain drop-shadow-[0_10px_8px_rgba(0,0,0,0.5)]" style={{ transform: facing === 'left' ? 'scaleX(-1)' : 'scaleX(1)' }}/>
            </div>

            <DirectionalPad onStartMove={startMove} onStopMove={stopMove} />
          </div>
        </div>
      )}

      {/* GARDEN CHOICE */}
      {stageState === 'garden-choice' && (
        <div 
          className="w-full h-full flex flex-col items-center justify-end pb-10 bg-green-800 bg-cover bg-center"
          style={{ backgroundImage: "url('/lush_garden.png')" }}
        >
          <div className="flex gap-8 bg-white/95 p-6 rounded-xl border-4 border-black shadow-[4px_4px_0px_#000]">
            <button onClick={() => { onActionSelect('fishing'); setMinigameStatus('playing'); }} className="flex flex-col items-center bg-blue-100 hover:bg-blue-200 border-4 border-black p-4 rounded shadow-[4px_4px_0px_#000] active:translate-y-1 transition-transform">
              <span className="text-5xl mb-2">🎣</span><span className="text-black font-black text-sm uppercase">Go Fishing</span>
            </button>
            <button onClick={() => { onActionSelect('fruit'); setApplesCaught(0); setMinigameStatus('playing'); }} className="flex flex-col items-center bg-red-100 hover:bg-red-200 border-4 border-black p-4 rounded shadow-[4px_4px_0px_#000] active:translate-y-1 transition-transform">
              <span className="text-5xl mb-2">🍎</span><span className="text-black font-black text-sm uppercase">Pick Fruit</span>
            </button>
          </div>
        </div>
      )}

      {/* ACTION SCENE (MINIGAMES & SUCCESS) */}
      {stageState === 'action-scene' && (
        <div 
          className="w-full h-full flex flex-col justify-end items-center bg-slate-900 relative bg-cover bg-center border-4 border-black"
          style={{ 
            backgroundImage: selectedAction === 'fishing' ? "url('/fishing.png')" : "url('/lush_garden.png')" 
          }}
        >
          <div className="w-[90%] bg-slate-800/95 border-4 border-black p-4 mb-4 rounded-xl shadow-[6px_6px_0px_#000] flex flex-col items-center backdrop-blur-sm z-30">
            
            {selectedAction === 'fishing' && minigameStatus === 'playing' && (
              <div className="w-full flex items-center gap-4">
                <h3 className="text-sm font-black text-white uppercase tracking-wider shrink-0">🎣 Reel Game:</h3>
                <div className="flex-1 h-8 bg-slate-950 border-2 border-black relative rounded overflow-hidden">
                  <div className="absolute top-0 bottom-0 left-[30%] w-[40%] bg-green-500 opacity-80 border-x border-green-300" />
                  <div className="absolute top-0 bottom-0 w-2 bg-red-500 border border-white" style={{ left: `calc(${fishingCursor}% - 4px)` }} />
                </div>
                <button onClick={attemptCatch} className="bg-blue-500 hover:bg-blue-400 text-white border-2 border-black px-4 py-2 text-xs font-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 uppercase shrink-0 rounded">REEL IT IN!</button>
              </div>
            )}

            {selectedAction === 'fruit' && minigameStatus === 'playing' && (
              <div className="w-full flex flex-col items-center">
                <div className="w-full flex justify-between items-center mb-2">
                  <h3 className="text-xs font-black text-white uppercase">🍎 Click the Apples!</h3>
                  <div className="bg-white text-black text-xs font-black px-2 py-0.5 border-2 border-black rounded shadow-[2px_2px_0px_#000]">Apples: {applesCaught}/5</div>
                </div>
                <div className="w-full max-w-[200px] aspect-square bg-green-900/50 rounded border-2 border-black p-2">
                  <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-1">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-center border border-dashed border-green-600/30">
                        {appleIndex === i && <button onClick={handleAppleClick} className="text-3xl hover:scale-110 active:scale-95 transition-transform">🍎</button>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {minigameStatus === 'lost' && (
              <div className="w-full flex items-center justify-between px-4 py-1">
                <p className="text-sm font-black text-red-400 uppercase tracking-wide">💦 It slipped away!</p>
                <button onClick={() => setMinigameStatus('playing')} className="bg-amber-400 text-black border-2 border-black px-4 py-1.5 text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-amber-300 active:translate-y-0.5 rounded">Try Again</button>
              </div>
            )}

            {minigameStatus === 'won' && (
              <div className="w-full flex items-center justify-between px-4 py-1">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{selectedAction === 'fishing' ? '🐟' : '🧺'}</span>
                  <p className="text-sm font-black text-green-400 uppercase tracking-wide">{selectedAction === 'fishing' ? 'Caught successfully!' : 'Harvest gathered!'}</p>
                </div>
                {/* ➔ Changes button handler callback route to advance into the oasis map exploration stage */}
                <button 
                  onClick={onTransitionToChallenge}
                  className="bg-yellow-400 text-black border-2 border-black px-4 py-1.5 text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-yellow-300 active:translate-y-0.5 rounded uppercase"
                >
                  Explore the Oasis ➔
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. 📦 CHEST STAGE (OASIS EDITION) */}
      {stageState === 'chest-oasis' && (
        <div className="w-full h-full flex items-center justify-center bg-slate-950 p-2">
          <div 
            className="relative border-4 border-black shadow-[4px_4px_0px_#000] bg-slate-800 overflow-hidden"
            style={{
              width: '800px', height: '600px',
              backgroundImage: "url('/chest_oasis.png')",
              backgroundSize: '100% 100%', backgroundPosition: 'center'
            }}
          >
            {/* INVISIBLE CLICKABLE CHEST HOTSPOT */}
            <button 
              onClick={onTransitionToChallenge} 
              // Positioning exactly at { x: 497, y: 448 }
              className="absolute w-24 h-24 -translate-x-1/2 -translate-y-1/2 cursor-pointer outline-none hover:bg-yellow-400/20 rounded-full transition-all animate-pulse"
              style={{ left: '497px', top: '448px' }}
              aria-label="Click to open chest"
            >
              {/* Optional: Add a little icon so they know to click */}
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 text-2xl">✨</span>
            </button>
          </div>
        </div>
      )}

      {/* SOLVED STAGE */}
      {stageState === 'solved' && (
        <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-amber-100 border-4 border-black p-6 shadow-[8px_8px_0px_#000] max-w-sm text-black">
            <h2 className="text-xl font-black mb-4 uppercase text-amber-900 border-b-4 border-black pb-2">Hypostasis (Assurance)</h2>
            <p className="text-sm font-bold text-slate-800 text-left mb-4">In ancient business, a <i>hypostasis</i> was a title deed—a physical piece of paper that proved you owned a piece of land, even if you hadn't walked on it yet.</p>
            {/* 3. NEW: Dynamic chunks displaying the first two fragments! */}
            <p className="text-lg font-black text-slate-900 bg-white p-2 border-2 border-black shadow-[2px_2px_0px_#000]">
              "{verseChunks.length >= 2 ? `${verseChunks[0]} ${verseChunks[1]}` : 'Forging...'}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
}