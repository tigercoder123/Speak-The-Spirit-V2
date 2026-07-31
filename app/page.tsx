'use client';

import React, { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import AuthGate from '../components/AuthGate';
import GameHeader from '../components/GameHeader';
import ConsoleLog from '../components/ConsoleLog';
import IntroDialogue from '../components/IntroDialogue';
import OverworldMap from '../components/OverworldMap';
import QuestRiddle from '../components/QuestRiddle';
import BattleArea from '../components/BattleArea';
import Debrief from '../components/Debrief';
import BasecampShop from '../components/BasecampShop';
import OnboardingFlow from '../components/OnboardingFlow';
import { supabase } from '../services/supabaseService';
import BackgroundMusic from '../components/BackgroundMusic';

function GameContent() {
  const {
    currentScreen,
    isLoggedIn,
    isDemo,
    userId,
    portalActive,
    isTransactionPending
  } = useGame();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (isLoggedIn && userId) {
      async function checkProfile() {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', userId)
            .single();

          if (error || !data?.display_name) {
            setNeedsOnboarding(true);
          } else if (needsOnboarding) {
            setNeedsOnboarding(false);
          }
        } catch (err) {
          console.error("Error checking profile for onboarding:", err);
        }
      }
      checkProfile();
    } else if (needsOnboarding) {
      setNeedsOnboarding(false);
    }
  }, [isLoggedIn, userId, needsOnboarding]);

  if (!isLoggedIn && !isDemo) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <AuthGate />
      </div>
    );
  }

  if (needsOnboarding) {
    return <OnboardingFlow />;
  }

  const renderLoadingScreen = () => (
    <div className="absolute inset-0 bg-slate-900 z-[60] flex flex-col items-center justify-center p-8 text-center">
      <div className="w-32 h-32 rounded-full border-8 border-black bg-yellow-400 animate-spin-slow flex items-center justify-center neo-box">
        <div className="w-20 h-20 rounded-full border-4 border-black bg-pink-500 animate-ping"></div>
      </div>
      <h2 className="text-2xl font-black mt-8 text-white tracking-tighter uppercase">
        Communicating with the Spirit Realm...
      </h2>
      <p className="text-yellow-400 font-bold mt-2 animate-pulse">
        Please Wait.
      </p>
    </div>
  );

  const renderPortal = () => (
    <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-8 text-center">
      <div className="absolute inset-0 bg-radial-gradient from-violet-600/30 via-transparent to-transparent animate-radial-pulse"></div>
      <div className="w-48 h-48 rounded-full border-8 border-dashed border-cyan-400 animate-spin-slow flex items-center justify-center relative">
        <div className="w-32 h-32 rounded-full border-8 border-dotted border-pink-500 animate-spin flex items-center justify-center">
          <span className="text-6xl animate-ping">✨</span>
        </div>
      </div>
      <h2 className="text-3xl font-black mt-8 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-pink-400 to-yellow-300 animate-pulse tracking-widest uppercase">
        RESTORING FREQUENCIES
      </h2>
      <p className="text-yellow-400 font-semibold mt-3 animate-bounce">
        {"\"For God so loved the world...\" soundwaves are breaking the silent curse!"}
      </p>
    </div>
  );

  const renderScreen = () => {
    switch (currentScreen) {
      case 'INTRO': return <IntroDialogue />;
      case 'OVERWORLD': return <OverworldMap />;
      case 'QUEST': return <QuestRiddle />;
      case 'BATTLE': return <BattleArea />;
      case 'DEBRIEF': return <Debrief />;
      case 'SHOP': return <BasecampShop />;
      default: return <IntroDialogue />;
    }
  };

  return (
    <div className="w-screen h-screen max-h-screen flex flex-col overflow-hidden p-0 m-0 bg-slate-950 text-slate-100 font-mono selection:bg-yellow-400 selection:text-black">

      <BackgroundMusic />
      
      <GameHeader />
      <main className="flex-1 w-full p-6 overflow-y-auto bg-slate-800 rounded-none neo-box relative overflow-hidden">
        {isTransactionPending && renderLoadingScreen()}
        {portalActive && renderPortal()}
        {renderScreen()}
      </main>
      <ConsoleLog />
    </div>
  );
}

export default function Home() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>}>
      <GameContent />
    </React.Suspense>
  );
}


