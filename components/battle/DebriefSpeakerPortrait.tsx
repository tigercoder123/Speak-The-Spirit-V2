'use client';

import React from 'react';
import { DEBRIEF_BREATHE_DURATION_MS, DEBRIEF_BREATHE_SCALE } from '../../config/battleApproach';

// Matches the w-20/h-20 (80px) box below - kept as one constant since the
// crop math and the Tailwind size must always agree.
const PORTRAIT_SIZE_PX = 80;

export interface DebriefPortraitCrop {
  naturalWidth: number;
  naturalHeight: number;
  /** The image's actual visible (non-transparent) pixels, in its natural coordinate space. */
  visibleBox: { left: number; top: number; right: number; bottom: number };
}

interface DebriefSpeakerPortraitProps {
  imageSrc: string;
  alt: string;
  /** Name label shown above the portrait, e.g. "Songbeast" or "You". */
  label: string;
  /** Whether this portrait's owner is the one currently speaking - dims/
   * de-emphasizes the other portrait so kids always know who's talking. */
  active: boolean;
  /** For source images that are one layer of a larger, same-canvas-sized
   * composite (e.g. the Songbeast's restored head - see
   * config/battleAssets.ts's SONGBEAST_RESTORED_HEAD_PORTRAIT_CROP) - a plain
   * object-contain render of the layer alone shows it tiny and off-center,
   * so this zooms/positions it to fill the portrait instead. Omit for
   * ordinary standalone sprites (e.g. the player's own character art). */
  crop?: DebriefPortraitCrop;
}

function cropToStyle(crop: DebriefPortraitCrop): React.CSSProperties {
  const { naturalWidth, naturalHeight, visibleBox } = crop;
  const boxWidth = visibleBox.right - visibleBox.left;
  const boxHeight = visibleBox.bottom - visibleBox.top;
  // Scale so the visible region fully covers the portrait (may crop
  // slightly in the other axis) - the same "cover" logic as CSS
  // object-fit: cover, just computed against the visible sub-region instead
  // of the whole (mostly transparent) canvas.
  const scale = Math.max(PORTRAIT_SIZE_PX / boxWidth, PORTRAIT_SIZE_PX / boxHeight);
  const centerX = (visibleBox.left + visibleBox.right) / 2;
  const centerY = (visibleBox.top + visibleBox.bottom) / 2;
  return {
    position: 'absolute',
    width: naturalWidth * scale,
    height: naturalHeight * scale,
    left: PORTRAIT_SIZE_PX / 2 - centerX * scale,
    top: PORTRAIT_SIZE_PX / 2 - centerY * scale,
    maxWidth: 'none',
  };
}

// Restored-form Songbeast head (or the player), sticking out of its own
// circle - the circle itself breathes continuously via .animate-breathe
// (app/globals.css), amount/speed passed in as CSS custom properties from
// config/battleApproach.ts rather than hardcoded in the keyframe itself.
// Breathing is applied to the circle, not the image directly, so a cropped
// image's positioning math (see cropToStyle) still holds at every point in
// the pulse - the whole circle scales together.
export default function DebriefSpeakerPortrait({ imageSrc, alt, label, active, crop }: DebriefSpeakerPortraitProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-[10px] font-black uppercase tracking-wide ${active ? 'text-yellow-300' : 'text-slate-400'}`}>
        {label}
      </span>
      <div
        className={`debrief-portrait-anchor animate-breathe relative overflow-hidden ${active ? 'debrief-portrait-active' : ''}`}
        style={
          {
            width: PORTRAIT_SIZE_PX,
            height: PORTRAIT_SIZE_PX,
            '--breathe-scale': DEBRIEF_BREATHE_SCALE,
            '--breathe-duration': `${DEBRIEF_BREATHE_DURATION_MS}ms`,
          } as React.CSSProperties
        }
      >
        {crop ? (
          <img src={imageSrc} alt={alt} style={cropToStyle(crop)} />
        ) : (
          <img src={imageSrc} alt={alt} className="absolute inset-0 h-full w-full object-contain object-bottom" />
        )}
      </div>
    </div>
  );
}
