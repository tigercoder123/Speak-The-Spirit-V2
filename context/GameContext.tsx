'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { addLog as emitGameLog } from '../utils/gameEvents';
import { supabase, supabaseService } from '../services/supabaseService';
import { BATTLE_ROUNDS } from '../utils/battleData';

export type Screen = 'INTRO' | 'OVERWORLD' | 'QUEST' | 'BATTLE' | 'DEBRIEF' | 'SHOP';

export interface LogEntry {
  text: string;
  type: 'system' | 'angel' | 'battle' | 'shop' | 'songbeast';
  timestamp: string;
}

export type LoginMethod = 'SUPABASE' | null;

interface GameContextType {
  // Navigation / Auth State
  currentScreen: Screen;
  setCurrentScreen: (screen: Screen) => void;
  isLoggedIn: boolean;
  userId: string | null;
  loginMethod: LoginMethod;
  handleLogout: () => void;
  isDemo: boolean;
  startDemo: () => void;

  //New: verse chunks state
  verseChunks: string[];
  setVerseChunks: (chunks: string[]) => void;

  //avatar tracking
  avatarUrl: string | null;
  characterPath: string;
  displayName: string | null;
  gradeLevel: string | null;

  // Game Logic State
  introStep: number;
  setIntroStep: (step: number) => void;
  questObjectClicked: boolean;
  setQuestObjectClicked: (clicked: boolean) => void;
  battleStep: number;
  setBattleStep: (step: number) => void;
  battleShieldHp: number;
  setBattleShieldHp: (hp: number) => void;
  portalActive: boolean;
  setPortalActive: (active: boolean) => void;
  isSongbeastRehomed: boolean;
  setIsSongbeastRehomed: (rehomed: boolean) => void;

  // Currencies / Inventory
  cupcakes: number;
  setCupcakes: (val: number | ((prev: number) => number)) => void;
  cucumbers: number;
  setCucumbers: (val: number | ((prev: number) => number)) => void;
  tickets: number;
  setTickets: (val: number | ((prev: number) => number)) => void;
  hasSwordOfTruth: boolean;
  setHasSwordOfTruth: (val: boolean) => void;
  hasHolyWater: boolean;
  setHasHolyWater: (val: boolean) => void;

  // Progression Tracking
  clearedIslands: string[];
  clearIsland: (islandName: string) => void;

  // Interface Feedbacks
  feedback: string;
  setFeedback: (fb: string) => void;
  shakeTrigger: boolean;
  setShakeTrigger: (val: boolean) => void;
  isTransactionPending: boolean;
  setIsTransactionPending: (pending: boolean) => void;
  gameLogs: LogEntry[];
  setGameLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;

  // Actions
  triggerShake: () => void;
  handleResetGame: () => void;
  handleBattleAnswer: (answer: string) => void;
  handleUseSwordOfTruth: () => void;
  handleTriggerPortal: () => void;

  isMuted: boolean;
  setIsMuted: (val: boolean) => void;
  
  // 🎵 NEW: Track management
  currentTrack: string;
  setCurrentTrack: (trackPath: string) => void;
}


const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Navigation & Authentication
  const [currentScreen, setCurrentScreenState] = useState<Screen>('INTRO');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>(null);
  const [isDemo, setIsDemo] = useState<boolean>(false);
  // Ref mirror of isDemo so the auth listener can read it without re-subscribing
  const isDemoRef = React.useRef(false);

  const[verseChunks, setVerseChunks] = useState<string[]>([]);
  // Gameplay Progress
  const [introStep, setIntroStep] = useState<number>(0);
  const [questObjectClicked, setQuestObjectClicked] = useState<boolean>(false);
  const [battleStep, setBattleStep] = useState<number>(0);
  const [battleShieldHp, setBattleShieldHp] = useState<number>(100);
  const [portalActive, setPortalActive] = useState<boolean>(false);
  const [isSongbeastRehomed, setIsSongbeastRehomed] = useState<boolean>(false);

  // Currencies & Inventory
  const getSavedReward = (key: string) => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem('sts_rewards');
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      return parsed[key];
    } catch {
      return null;
    }
  };

  const [cupcakes, setCupcakesState] = useState<number>(() => getSavedReward('cupcakes') ?? 0);
  const [cucumbers, setCucumbersState] = useState<number>(() => getSavedReward('cucumbers') ?? 0);
  const [tickets, setTicketsState] = useState<number>(() => getSavedReward('tickets') ?? 0);
  const [hasSwordOfTruth, setHasSwordOfTruth] = useState<boolean>(false);
  const [hasHolyWater, setHasHolyWater] = useState<boolean>(false);

  // Progression
  const [clearedIslands, setClearedIslands] = useState<string[]>([]);

  // 👤 NEW: State for the avatar URL from Supabase
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null); // 👈 NEW
  const [gradeLevel, setGradeLevel] = useState<string | null>(null);

  const [isMuted, setIsMuted] = useState(true);
  const[currentTrack,setCurrentTrack]= useState ('/audio/crossroads.mp3');

  // 👤 NEW: Derived character path for your 2D sprites!
  // Defaults to girlnobackground if NULL or not set to boy
  const characterPath = avatarUrl?.includes('boy') 
    ? "/characters/boynobackground.png" 
    : "/characters/girlnobackground.png";

  // Visual / Feedback State
  const [feedback, setFeedback] = useState<string>('');
  const [shakeTrigger, setShakeTrigger] = useState<boolean>(false);
  const [isTransactionPending, setIsTransactionPending] = useState<boolean>(false);
  const [gameLogs, setGameLogs] = useState<LogEntry[]>([]);

  const setCurrentScreen = React.useCallback((screen: Screen) => {
    setCurrentScreenState(screen);
    router.push(`?screen=${screen}`, { scroll: false });
  }, [router]);

  // --- MOCK SMART CONTRACT BRIDGE (LocalStorage) ---
  const persistRewards = (newCupcakes: number, newCucumbers: number, newTickets: number) => {
    localStorage.setItem('sts_rewards', JSON.stringify({
      cupcakes: newCupcakes,
      cucumbers: newCucumbers,
      tickets: newTickets,
    }));
  };

  // Internal helper to reset state without triggering another signOut
  const cleanupAuthAndState = React.useCallback(() => {
    setIsLoggedIn(false);
    setUserId(null);
    setLoginMethod(null);
    
    if (currentScreen !== 'INTRO') {
      setCurrentScreen('INTRO');
    }

    // Fully clear out game state
    setIntroStep(0);
    setQuestObjectClicked(false);
    setBattleStep(0);
    setBattleShieldHp(100);
    setPortalActive(false);
    setIsSongbeastRehomed(false);
    setCupcakesState(0);
    setCucumbersState(0);
    setTicketsState(0);
    setClearedIslands([]);
    setHasSwordOfTruth(false);
    setHasHolyWater(false);
    setFeedback('');

    emitGameLog("Player session ended. Game state cleared.", "system");
  }, [currentScreen, setCurrentScreen]);

  const loadOfflineFallback = () => {
    const savedRewards = localStorage.getItem('sts_rewards');
    if (savedRewards) {
      try {
        const { cupcakes: sCup, cucumbers: sCuc, tickets: sTix } = JSON.parse(savedRewards);
        setCupcakesState(sCup);
        setCucumbersState(sCuc);
        setTicketsState(sTix);
      } catch (e) {
        console.error("Failed to parse saved rewards", e);
      }
    } else {
      setCupcakesState(5);
      setCucumbersState(5);
      setTicketsState(1);
    }
  };

  // --- SUPABASE DATABASE INTEGRATION ---
  const fetchProfile = React.useCallback(async (id: string) => {
    try {
      const profile = await supabaseService.fetchProfile(id);

      if (profile) {
        setCupcakesState(profile.cupcakes ?? 5);
        setCucumbersState(profile.cucumbers ?? 5);
        setTicketsState(profile.tickets ?? 1);
        
        // 👤 NEW: Save the avatar URL from the database
        setAvatarUrl(profile.avatar_url || null);
        setDisplayName (profile.display_name || 'Traveler'); //new
        setGradeLevel(profile.grade_level || null);

        const loadedIslands = profile.clearedIslands || [];
        setClearedIslands(loadedIslands);
        
        persistRewards(profile.cupcakes ?? 5, profile.cucumbers ?? 5, profile.tickets ?? 1);
      } else {
        loadOfflineFallback();
      }
    } catch (err: unknown) {
      console.error("Supabase profile fetch exception:", err);
      emitGameLog("Database exception. Using offline fallback.", "system");
      loadOfflineFallback();
    }
  }, []);

  const saveProfile = async (id: string, updatedFields: {
    cupcakes?: number;
    cucumbers?: number;
    tickets?: number;
    clearedIslands?: string[];
  }) => {
    try {
      await supabaseService.saveProfile(id, updatedFields);
    } catch (err) {
      console.error("Supabase profile update exception:", err);
    }
  };

  // Supabase Auth Listener
  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsLoggedIn(true);
        setUserId(session.user.id);
        setLoginMethod('SUPABASE');
        fetchProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setIsLoggedIn(true);
        setUserId(session.user.id);
        setLoginMethod('SUPABASE');
        fetchProfile(session.user.id);
      } else if (!isDemoRef.current) {
        // In demo mode there's intentionally no session — don't wipe state or bounce to INTRO
        cleanupAuthAndState();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile, cleanupAuthAndState]);


  // Wrappers for currency updates to ensure persistence
  const setCupcakes = (val: number | ((prev: number) => number)) => {
    setCupcakesState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      queueMicrotask(() => {
        persistRewards(next, cucumbers, tickets);
        if (userId) {
          saveProfile(userId, { cupcakes: next });
        }
      });
      return next;
    });
  };

  const setCucumbers = (val: number | ((prev: number) => number)) => {
    setCucumbersState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      queueMicrotask(() => {
        persistRewards(cupcakes, next, tickets);
        if (userId) {
          saveProfile(userId, { cucumbers: next });
        }
      });
      return next;
    });
  };

  const setTickets = (val: number | ((prev: number) => number)) => {
    setTicketsState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      queueMicrotask(() => {
        persistRewards(cupcakes, cucumbers, next);
        if (userId) {
          saveProfile(userId, { tickets: next });
        }
      });
      return next;
    });
  };

  // Progression Tracking Clear Island
  const clearIsland = async (islandName: string) => {
    setClearedIslands((prev) => {
      if (prev.includes(islandName)) return prev;
      const next = [...prev, islandName];
      queueMicrotask(() => {
        if (userId) {
          saveProfile(userId, { clearedIslands: next });
        }
      });
      return next;
    });
    emitGameLog(`Cleared island progression updated: ${islandName}!`, "system");
  };

  // Visual shaker helper
  const triggerShake = () => {
    setShakeTrigger(true);
    setTimeout(() => setShakeTrigger(false), 500);
  };

  // --- BATTLE LOGIC ---
  const handleBattleAnswer = (answer: string) => {
    const currentRound = BATTLE_ROUNDS[battleStep];
    if (answer === currentRound.correct) {
      emitGameLog(`Correct! Selected "${answer}". The Silencer's shield takes damage!`, "battle");
      const nextHp = Math.max(0, battleShieldHp - 33);
      setBattleShieldHp(nextHp);
      if (battleStep < BATTLE_ROUNDS.length - 1) {
        setBattleStep(battleStep + 1);
        setFeedback("Holy frequencies matching! Keep decoding!");
      } else {
        setBattleShieldHp(0);
        setFeedback("Shield fully neutralized! The Songbeast is ready to be restored!");
        emitGameLog("The Silencer's noise shield is down! Trigger the restoration portal!", "system");
      }
    } else {
      triggerShake();
      setFeedback("Static interference! That word didn't match the vibration of Truth.");
      emitGameLog(`Incorrect answer "${answer}". The Silencer's shield deflected the strike.`, "battle");
    }
  };

  const handleUseSwordOfTruth = () => {
    if (!hasSwordOfTruth) return;
    emitGameLog("You raise the Sword of Truth! Pure radiant light pierces the static barrier!", "battle");
    setBattleShieldHp(0);
    setBattleStep(BATTLE_ROUNDS.length - 1);
    setFeedback("The Sword of Truth instantly shattered the Silencer's barrier!");
  };

  const handleTriggerPortal = () => {
    setPortalActive(true);
    emitGameLog("Activating Born Again Portal... Restoring frequencies!", "system");
    setTimeout(() => {
      setPortalActive(false);
      setCurrentScreen('DEBRIEF');
      emitGameLog("Songbeast Barnaby restored successfully! Entering debrief phase.", "songbeast");
    }, 2500);
  };

  // Authentication Functions
  const handleLogout = async () => {
    isDemoRef.current = false;
    setIsDemo(false);
    try {
      await supabase.auth.signOut();
      // cleanupAuthAndState is called automatically via onAuthStateChange
    } catch (err) {
      console.error("Error during sign out:", err);
      cleanupAuthAndState();
    }
  };

  // Demo Mode: lets a guest jump straight into the intro video without an account
  const startDemo = () => {
    isDemoRef.current = true;
    setIsDemo(true);
    setIntroStep(0);
    loadOfflineFallback();

    // Demo guests have no profile/userId, so seed sensible defaults the quest scenes expect.
    // Name already falls back to 'Traveler' in the UI; grade tunes hint difficulty (TK = easiest).
    setGradeLevel('TK');
    // The memory verse (Hebrews 11:1) normally loads via YouVersion/Gloo, which requires a userId.
    // Preload it here so the quest riddles show real content instead of "Forging..." placeholders.
    setVerseChunks([
      'Now faith is confidence',
      'in what we hope for',
      'and assurance about what we do not see.',
    ]);

    setCurrentScreen('INTRO');
    emitGameLog("Demo mode started. Playing the intro vision...", "system");
  };

  // Reset Progression State
  const handleResetGame = async () => {
    setCurrentScreen('INTRO');
    setIntroStep(0);
    setQuestObjectClicked(false);
    setBattleStep(0);
    setBattleShieldHp(100);
    setPortalActive(false);
    setIsSongbeastRehomed(false);
    
    const resetCupcakes = 5;
    const resetCucumbers = 5;
    const resetTickets = 1;
    setCupcakesState(resetCupcakes);
    setCucumbersState(resetCucumbers);
    setTicketsState(resetTickets);
    setClearedIslands([]);
    
    setHasSwordOfTruth(false);
    setHasHolyWater(false);
    setFeedback('');
    emitGameLog("Game values reset to start. Starting over...", "system");

    if (userId) {
      await saveProfile(userId, {
        cupcakes: resetCupcakes,
        cucumbers: resetCucumbers,
        tickets: resetTickets,
        clearedIslands: [],
      });
    } else {
      persistRewards(resetCupcakes, resetCucumbers, resetTickets);
    }
  };

  return (
    <GameContext.Provider
      value={{
        currentScreen,
        setCurrentScreen,
        isLoggedIn,
        userId,
        loginMethod,
        handleLogout,
        isDemo,
        startDemo,

        //expose the chunks!
        verseChunks,
        setVerseChunks,

        introStep,
        setIntroStep,
        questObjectClicked,
        setQuestObjectClicked,
        battleStep,
        setBattleStep,
        battleShieldHp,
        setBattleShieldHp,
        portalActive,
        setPortalActive,
        isSongbeastRehomed,
        setIsSongbeastRehomed,

        cupcakes,
        setCupcakes,
        cucumbers,
        setCucumbers,
        tickets,
        setTickets,
        hasSwordOfTruth,
        setHasSwordOfTruth,
        hasHolyWater,
        setHasHolyWater,

        clearedIslands,
        clearIsland,

        feedback,
        setFeedback,
        shakeTrigger,
        setShakeTrigger,
        isTransactionPending,
        setIsTransactionPending,
        gameLogs,
        setGameLogs,

        triggerShake,
        handleResetGame,
        handleBattleAnswer,
        handleUseSwordOfTruth,
        handleTriggerPortal,

        avatarUrl,      // 👈 NEW
        characterPath,  // 👈 NEW
        displayName,
        gradeLevel,
        isMuted,
        setIsMuted,
        currentTrack,
        setCurrentTrack,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
