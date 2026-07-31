'use client';

import { useRef, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

interface ParchmentOverlayProps {
  children: ReactNode;
}

// Shared positioning shell for every screen that covers the battle scene
// (challenge, correct/incorrect banners, response choice) - same size,
// position, and edge-blur for all of them, so switching between them reads
// as one continuous screen rather than a new layout. Each screen's own card
// (border/shadow/background) stays on the child component - see
// VerseParchment/ResponseChoices/FeedbackBanner - so this only owns
// placement and the blurred pass-through edge.
export default function ParchmentOverlay({ children }: ParchmentOverlayProps) {
  const edgeBlurRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.set(edgeBlurRef.current, { opacity: 0 });
    gsap.set(contentRef.current, { opacity: 0, y: 8, scale: 0.96 });
    gsap.to(edgeBlurRef.current, { opacity: 1, duration: 0.3, ease: 'power1.out' });
    gsap.to(contentRef.current, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'power2.out', delay: 0.05 });
  }, []);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-6 sm:p-10">
      <div ref={edgeBlurRef} className="absolute inset-0 bg-slate-950/30 backdrop-blur-md" />
      <div ref={contentRef} className="relative w-full max-w-xl">
        {children}
      </div>
    </div>
  );
}
