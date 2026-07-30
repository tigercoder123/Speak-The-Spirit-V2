'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Position {
  x: number;
  y: number;
}

export type FacingDirection = 'left' | 'right';

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface PlayerWalkerBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface PlayerWalkerPath {
  waypoints: Position[];
  /** Max distance (px) from any waypoint a target position may land at and
   * still count as "on the path". */
  tolerance: number;
}

export interface UsePlayerWalkerOptions {
  initialPosition: Position;
  /** Pixels moved per movement tick while a direction is held. */
  speed: number;
  bounds: PlayerWalkerBounds;
  /** When provided, a move only commits if the target position lands within
   * `tolerance` px of at least one waypoint - confines the player to a
   * traced path, and rejects (no-ops) a move that would land outside
   * `bounds` entirely. Omitted, movement is free within `bounds` (clamped
   * to the nearest in-bounds point rather than rejected). */
  path?: PlayerWalkerPath;
  /** Whether WASD/arrow-key input should currently move the player - false
   * while this walking stage isn't the active one, so keys don't leak into
   * other stages/minigames a caller might share a component with. */
  enabled: boolean;
}

export interface UsePlayerWalkerResult {
  position: Position;
  facing: FacingDirection;
  /** Sets position directly, bypassing bounds/path checks - for placing the
   * player at a spawn point when a new stage/map begins. */
  setPosition: (position: Position) => void;
  /** Attempts to move by (dx, dy) once; no-ops if the target lands outside
   * bounds, or (when `path` is given) off the traced path. */
  attemptMove: (dx: number, dy: number) => void;
  /** Starts continuously moving in `direction` (e.g. a D-pad button's
   * onMouseDown/onTouchStart) - keeps moving every tick until stopMove is
   * called for that same direction. Holding two perpendicular directions at
   * once (from the keyboard, from two D-pad buttons, or one of each)
   * combines into continuous diagonal movement. */
  startMove: (direction: Direction) => void;
  /** Stops continuous movement in `direction` (onMouseUp/onMouseLeave/onTouchEnd). */
  stopMove: (direction: Direction) => void;
}

function isOnPath(x: number, y: number, path: PlayerWalkerPath): boolean {
  return path.waypoints.some((point) => Math.hypot(x - point.x, y - point.y) <= path.tolerance);
}

function keyToDirection(key: string): Direction | null {
  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      return 'up';
    case 'ArrowDown':
    case 's':
    case 'S':
      return 'down';
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'left';
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'right';
    default:
      return null;
  }
}

// How often a held direction re-applies a movement step - decoupled from any
// key/mouse auto-repeat rate (which varies by OS/browser and can't combine
// two independently-timed repeats into a clean diagonal) so holding stays
// smooth and continuous regardless of input source.
const MOVE_TICK_MS = 60;

/**
 * Shared 2D top-down walking mechanics - position, facing, WASD/arrow-key
 * and hold-to-move D-pad-button input, and either waypoint-path-gated or
 * free-within-bounds movement - used by every walkable scene in the game
 * (see components/quests/Crossroads/CrossroadsMap.tsx,
 * components/quests/HungerTrial/HungerTrialStage.tsx,
 * components/quests/RushingWaters/RushingWatersStage.tsx, and the Silencer
 * battle's approach view). Each caller still owns its own waypoints,
 * spawn-point resets, and scene-specific proximity triggers/side effects
 * (via its own useEffect watching the returned `position`) - this hook only
 * owns the walk mechanics themselves.
 */
export function usePlayerWalker({
  initialPosition,
  speed,
  bounds,
  path,
  enabled,
}: UsePlayerWalkerOptions): UsePlayerWalkerResult {
  const [position, setPosition] = useState<Position>(initialPosition);
  const [facing, setFacing] = useState<FacingDirection>('right');

  const attemptMove = useCallback(
    (dx: number, dy: number) => {
      if (dx < 0) setFacing('left');
      if (dx > 0) setFacing('right');

      setPosition((prev) => {
        const targetX = prev.x + dx;
        const targetY = prev.y + dy;

        if (path) {
          if (targetX < bounds.minX || targetX > bounds.maxX || targetY < bounds.minY || targetY > bounds.maxY) {
            return prev;
          }
          return isOnPath(targetX, targetY, path) ? { x: targetX, y: targetY } : prev;
        }

        return {
          x: Math.min(bounds.maxX, Math.max(bounds.minX, targetX)),
          y: Math.min(bounds.maxY, Math.max(bounds.minY, targetY)),
        };
      });
    },
    [bounds, path]
  );

  // Latest attemptMove/speed, read by the tick loop below - so a re-render
  // that gives attemptMove/speed a new identity mid-hold doesn't need to tear
  // down and restart the running interval.
  const attemptMoveRef = useRef(attemptMove);
  const speedRef = useRef(speed);
  useEffect(() => {
    attemptMoveRef.current = attemptMove;
    speedRef.current = speed;
  }, [attemptMove, speed]);

  // Every direction currently held down - from the keyboard or from a
  // caller's own D-pad buttons (via startMove/stopMove below) - combined on
  // every tick so holding two perpendicular directions moves diagonally,
  // continuously, regardless of which input source(s) are holding them.
  const heldDirectionsRef = useRef<Set<Direction>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    const held = heldDirectionsRef.current;
    const s = speedRef.current;
    let dx = 0;
    let dy = 0;
    if (held.has('up')) dy -= s;
    if (held.has('down')) dy += s;
    if (held.has('left')) dx -= s;
    if (held.has('right')) dx += s;
    if (dx !== 0 || dy !== 0) attemptMoveRef.current(dx, dy);
  }, []);

  const stopTicking = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTicking = useCallback(() => {
    if (intervalRef.current !== null) return;
    intervalRef.current = setInterval(tick, MOVE_TICK_MS);
  }, [tick]);

  const startMove = useCallback(
    (direction: Direction) => {
      heldDirectionsRef.current.add(direction);
      tick(); // immediate first step, so a press/keydown feels responsive
      startTicking();
    },
    [tick, startTicking]
  );

  const stopMove = useCallback(
    (direction: Direction) => {
      heldDirectionsRef.current.delete(direction);
      if (heldDirectionsRef.current.size === 0) stopTicking();
    },
    [stopTicking]
  );

  useEffect(() => {
    if (!enabled) return;

    const heldDirections = heldDirectionsRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;

      const direction = keyToDirection(e.key);
      if (!direction) return;
      e.preventDefault();
      startMove(direction);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const direction = keyToDirection(e.key);
      if (!direction) return;
      stopMove(direction);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      heldDirections.clear();
      stopTicking();
    };
  }, [enabled, startMove, stopMove, stopTicking]);

  return { position, facing, setPosition, attemptMove, startMove, stopMove };
}
