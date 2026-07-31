'use client';

import React from 'react';

interface FeedbackBannerProps {
  text: string;
}

export default function FeedbackBanner({ text }: FeedbackBannerProps) {
  if (!text) return null;

  return (
    <div className="text-center font-black text-lg uppercase px-4 py-2 rounded-xl border-4 border-black bg-green-400 text-black shadow-[3px_3px_0px_#000] animate-slide-in-up">
      {text}
    </div>
  );
}
