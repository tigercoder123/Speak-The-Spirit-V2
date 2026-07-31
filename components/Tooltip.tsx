'use client';

import React from 'react';

interface TooltipProps {
  /** Must match the id passed to the trigger's aria-describedby. */
  id: string;
  text: string;
}

// Small hand-painted-style tooltip, shown via pure CSS on hover/focus of
// whichever trigger it's paired with - wrap the trigger + this in a
// `.shop-tooltip-wrap` span (see app/globals.css for the
// .shop-tooltip-wrap/.shop-tooltip rules, including the prefers-reduced-
// motion override). No JS state: hover and keyboard focus both "just work"
// via :hover/:focus-within on the wrapper. Always present in the DOM (only
// visually hidden) so the trigger's aria-describedby reference always
// resolves and screen readers announce it on focus regardless of the mouse.
export default function Tooltip({ id, text }: TooltipProps) {
  return (
    <div
      role="tooltip"
      id={id}
      className="shop-tooltip"
      style={{
        position: 'absolute',
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginBottom: '0.5vw',
        zIndex: 60,
        width: 'max-content',
        maxWidth: '11vw',
        padding: '0.35vw 0.6vw',
        borderRadius: 8,
        border: '2px solid #5b3d16',
        background: '#fdf3dd',
        color: '#3a2408',
        fontWeight: 700,
        fontSize: 'clamp(8px, 0.85vw, 13px)',
        lineHeight: 1.25,
        textAlign: 'center',
        boxShadow: '0 3px 6px rgba(0,0,0,0.35)',
        whiteSpace: 'normal',
      }}
    >
      {text}
    </div>
  );
}
