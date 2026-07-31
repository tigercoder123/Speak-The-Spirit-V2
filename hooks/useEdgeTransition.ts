'use client';

import { useEffect, useRef } from 'react';
import type { Position } from './usePlayerWalker';

export interface UseEdgeTransitionOptions {
  position: Position;
  /** Whether this scene is currently the active one - false resets the
   * fired-once guard so re-entering the scene can trigger the transition
   * again on a later visit. */
  enabled: boolean;
  /** Which edge to watch: 'left' fires once position.x <= threshold, 'right'
   * once position.x >= threshold. */
  edge: 'left' | 'right';
  threshold: number;
  /** Called exactly once per approach, with the position at the moment the
   * edge was reached (so the caller can carry e.g. the y-coordinate into
   * wherever it transitions to). */
  onReachEdge: (position: Position) => void;
}

/**
 * Watches a walkable scene's player position (from usePlayerWalker) and
 * fires a callback once the player reaches a given edge - the same
 * "useEffect watching position" pattern already used for other in-scene
 * position-triggered side effects (e.g. RushingWatersStage's bridge
 * reveal), rather than checking inside the movement handler itself. Guarded
 * with a ref so lingering past the threshold doesn't fire it repeatedly.
 */
export function useEdgeTransition({ position, enabled, edge, threshold, onReachEdge }: UseEdgeTransitionOptions) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      firedRef.current = false;
      return;
    }
    const reachedEdge = edge === 'left' ? position.x <= threshold : position.x >= threshold;
    if (!firedRef.current && reachedEdge) {
      firedRef.current = true;
      onReachEdge(position);
    }
  }, [position, enabled, edge, threshold, onReachEdge]);
}
