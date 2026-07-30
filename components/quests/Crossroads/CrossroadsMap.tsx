import React, { useEffect } from 'react';
import { usePlayerWalker } from '../../../hooks/usePlayerWalker';
import DirectionalPad from '../../DirectionalPad';

interface CrossroadsMapProps {
  stageState: string;
  characterPath: string;
  onHitGhost: () => void;
  onHitXMarks: () => void;
  onReturnToFork: () => void;
  onClickChest: () => void;
}

const PLAYER_SPEED = 9;
const MAP_BOUNDS = { minX: 0, maxX: 800, minY: 0, maxY: 600 };
const PATH_TOLERANCE = 45;

export default function CrossroadsMap({
  stageState,
  characterPath,
  onHitGhost,
  onHitXMarks,
  onReturnToFork,
  onClickChest
}: CrossroadsMapProps) {
  // 🗺️ WAYPOINTS FOR BOTH MAPS
  const forkWaypoints = [
    // Your exact traced waypoints for the crossroads!
    { x: 368, y: 559 }, { x: 428, y: 562 }, { x: 431, y: 522 }, { x: 376, y: 506 }, { x: 365, y: 456 }, 
    { x: 368, y: 405 }, { x: 364, y: 354 }, { x: 356, y: 298 }, { x: 317, y: 284 }, { x: 272, y: 270 }, 
    { x: 229, y: 256 }, { x: 178, y: 242 }, { x: 154, y: 210 }, { x: 133, y: 168 }, { x: 119, y: 119 }, 
    { x: 116, y: 65 }, { x: 124, y: 26 }, { x: 184, y: 34 }, { x: 188, y: 81 }, { x: 203, y: 128 }, 
    { x: 216, y: 179 }, { x: 264, y: 203 }, { x: 318, y: 223 }, { x: 368, y: 238 }, { x: 437, y: 461 }, 
    { x: 436, y: 414 }, { x: 436, y: 355 }, { x: 436, y: 305 }, { x: 433, y: 242 }, { x: 401, y: 279 }, 
    { x: 491, y: 266 }, { x: 519, y: 224 }, { x: 580, y: 241 }, { x: 567, y: 194 }, { x: 624, y: 193 }, 
    { x: 569, y: 139 }, { x: 637, y: 135 }, { x: 661, y: 83 }, { x: 704, y: 120 }, { x: 744, y: 59 }, 
    { x: 698, y: 25 }, { x: 773, y: 18 }, { x: 548, y: 277 }, { x: 601, y: 94 }, { x: 471, y: 198 }
  ];

  const xMarksWaypoints = [
    // Placeholder dirt road for the second map (Replace these using the Debugger later!)
    { x: 19, y: 313 }, { x: 73, y: 302 }, { x: 134, y: 290 }, { x: 185, y: 300 }, { x: 239, y: 300 }, { x: 301, y: 317 }, { x: 347, y: 335 }, { x: 412, y: 338 }, { x: 472, y: 329 }, { x: 494, y: 367 }, { x: 418, y: 382 }, { x: 361, y: 382 }, { x: 310, y: 370 }, { x: 264, y: 354 }, { x: 208, y: 344 }, { x: 145, y: 344 }, { x: 92, y: 350 }, { x: 48, y: 361 }, { x: 8, y: 382 }, { x: 517, y: 302 }, { x: 544, y: 350 }, { x: 568, y: 286 }, { x: 602, y: 334 }
  ];

  const ghostWaypoints = [
    // A straight path down the center for the player to escape the ghosts
    { x: 400, y: 150 }, { x: 400, y: 200 }, { x: 400, y: 250 }, { x: 400, y: 300 },
    { x: 400, y: 350 }, { x: 400, y: 400 }, { x: 400, y: 450 }, { x: 400, y: 500 },
    { x: 400, y: 550 }, { x: 400, y: 600 }
  ];

  const isWalkableStage = stageState === 'fork' || stageState === 'x-marks' || stageState === 'ghosts';
  const currentWaypoints =
    stageState === 'x-marks' ? xMarksWaypoints : stageState === 'ghosts' ? ghostWaypoints : forkWaypoints;

  const { position: playerPos, facing, setPosition: setPlayerPos, startMove, stopMove } = usePlayerWalker({
    initialPosition: { x: 368, y: 550 },
    speed: PLAYER_SPEED,
    bounds: MAP_BOUNDS,
    path: { waypoints: currentWaypoints, tolerance: PATH_TOLERANCE },
    enabled: isWalkableStage,
  });

  // 🎯 Move player to specific entrances when changing maps
  useEffect(() => {
    if (stageState === 'x-marks') {
      setPlayerPos({ x: 50, y: 360 }); // Spawn left
    } else if (stageState === 'ghosts') {
      setPlayerPos({ x: 400, y: 200 }); // Spawn high up in the ghost path
    }
  }, [stageState, setPlayerPos]);

  // 🚨 EVENT TRIGGERS (Watched safely here)
  useEffect(() => {
    if (stageState === 'fork' && playerPos.y <= 60) {
      if (playerPos.x < 300) {
        onHitGhost();
      } else if (playerPos.x > 500) {
        onHitXMarks();
      }
    } else if (stageState === 'x-marks') {
      const musicNoteX = 560;
      const musicNoteY = 320;
      const distanceToNote = Math.sqrt(Math.pow(playerPos.x - musicNoteX, 2) + Math.pow(playerPos.y - musicNoteY, 2));

      if (distanceToNote <= 50) {
        onClickChest();
      }
    } else if (stageState === 'ghosts') {
      // If the player successfully walks back down to the bottom edge of the screen
      if (playerPos.y >= 580) {
        setPlayerPos({ x: 170, y: 100 }); // Spawn them right at the top of the spooky fork path
        onReturnToFork();
      }
    }
  }, [playerPos, stageState, onHitGhost, onHitXMarks, onClickChest, onReturnToFork, setPlayerPos]);

  // Determine which background to show dynamically
  const currentBackground = 
    stageState === 'fork' ? "url('/crossroads_map.png')" : 
    stageState === 'x-marks' ? "url('/note_on_path.png')" : 
    "url('/ghosts.png')";

  return (
    <div className="w-full h-full relative overflow-hidden flex items-center justify-center bg-slate-950 p-2">
      
      {/* 🟢 PLAYABLE MAP STAGES (Fork, X-Marks, or Ghosts) */}
      {(stageState === 'fork' || stageState === 'x-marks' || stageState === 'ghosts') && (
        <div 
          className="relative border-4 border-black shadow-[4px_4px_0px_#000] bg-slate-800 overflow-hidden transition-all"
          style={{
            width: '800px', height: '600px',
            backgroundImage: currentBackground,
            backgroundSize: '100% 100%', backgroundPosition: 'center'
          }}
        >
          {/* 🏃‍♂️ CHARACTER */}
          <div 
            className="absolute w-24 h-24 -translate-x-1/2 -translate-y-[80%] transition-all duration-75 ease-out z-20"
            style={{ left: `${playerPos.x}px`, top: `${playerPos.y}px` }}
          >
            <img 
              src={characterPath} 
              alt="Character" 
              // Dynamically apply grayscale and pulse if they are trapped in the ghosts stage!
              className={`w-full h-full object-contain drop-shadow-xl transition-all ${
                stageState === 'ghosts' ? 'filter grayscale animate-pulse' : ''
              }`} style={{ transform: facing === 'left' ? 'scaleX(-1)' : 'scaleX(1)' }}
            />
          </div>

          <DirectionalPad onStartMove={startMove} onStopMove={stopMove} />
        </div>
      )}

      {/* 📦 CHEST STAGE */}
      {stageState === 'chest' && (
        <div className="w-full h-full flex items-center justify-center bg-slate-950 p-2">
          <div 
            className="relative border-4 border-black shadow-[4px_4px_0px_#000] bg-slate-800 overflow-hidden"
            style={{
              width: '800px', height: '600px',
              backgroundImage: "url('/chest.png')",
              backgroundSize: '100% 100%', backgroundPosition: 'center'
            }}
          >
            {/* INVISIBLE CLICKABLE CHEST HOTSPOT */}
            <button 
              onClick={onClickChest} 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-48 cursor-pointer outline-none"
              aria-label="Click to open chest"
            >
              <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white border-2 border-black font-black px-4 py-2 uppercase shadow-[2px_2px_0px_#000] animate-bounce whitespace-nowrap">
                Click to Open
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}