'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { addLog as emitGameLog } from '../utils/gameEvents';
import { supabase, supabaseService } from '../services/supabaseService';
import type { Position } from '../hooks/usePlayerWalker';
import { DEFAULT_POWER_UP_COUNTS, type PowerUpType } from '../config/powerUpConfig';

export type Screen = 'INTRO' | 'OVERWORLD' | 'QUEST' | 'BATTLE' | 'CHEST_RETURN' | 'DEBRIEF' | 'SHOP';

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
  /** The player's chosen YouVersion Bible translation ID, set during onboarding - null until loaded/if unset. */
  bibleVersionId: number | null;
  setBibleVersionId: (id: number) => void;
  /** The player's chosen verse language code (e.g. 'en', 'es') - null until loaded/if unset. */
  bibleLanguage: string | null;
  setBibleLanguage: (language: string) => void;

  // Game Logic State
  introStep: number;
  setIntroStep: (step: number) => void;
  questObjectClicked: boolean;
  setQuestObjectClicked: (clicked: boolean) => void;
  isSongbeastRehomed: boolean;
  setIsSongbeastRehomed: (rehomed: boolean) => void;

  // Currencies / Inventory
  cupcakes: number;
  setCupcakes: (val: number | ((prev: number) => number)) => void;
  cucumbers: number;
  setCucumbers: (val: number | ((prev: number) => number)) => void;
  tickets: number;
  setTickets: (val: number | ((prev: number) => number)) => void;
  hasHolyWater: boolean;
  setHasHolyWater: (val: boolean) => void;
  powerUps: Record<PowerUpType, number>;
  setPowerUps: (
    val: Record<PowerUpType, number> | ((prev: Record<PowerUpType, number>) => Record<PowerUpType, number>)
  ) => void;

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

  isMuted: boolean;
  setIsMuted: (val: boolean) => void;

  // 🎵 NEW: Track management
  currentTrack: string;
  setCurrentTrack: (trackPath: string) => void;

  /** One-shot spawn override for the Silencer battle's EXPLORING view - set
   * when a transition (e.g. ChestReturnScene's left-edge hand-off) needs the
   * player to land somewhere other than EXPLORATION_PLAYER_SPAWN. Consumed
   * and cleared by hooks/useSilencerBattle.ts on mount; null means "use the
   * default spawn". */
  pendingBattleSpawn: Position | null;
  setPendingBattleSpawn: (position: Position | null) => void;

  /** Dev cheat (see GameHeader.tsx's "Cheat: Restored" button) - one-shot flag
   * telling the Silencer battle to skip straight to the RESTORED phase
   * (Songbeast already fully restored) instead of the normal EXPLORING/
   * challenge flow. Consumed and cleared by hooks/useSilencerBattle.ts on mount. */
  pendingBattleSkipToRestored: boolean;
  setPendingBattleSkipToRestored: (value: boolean) => void;
}


const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Navigation & Authentication
  // Restores the screen from the URL on load (setCurrentScreen already pushes
  // `?screen=...`, so a reload/direct link should land back on the same
  // screen instead of always resetting to INTRO).
  const [currentScreen, setCurrentScreenState] = useState<Screen>(() => {
    const fromUrl = searchParams.get('screen');
    const validScreens: Screen[] = ['INTRO', 'OVERWORLD', 'QUEST', 'BATTLE', 'CHEST_RETURN', 'DEBRIEF', 'SHOP'];
    return (validScreens as string[]).includes(fromUrl ?? '') ? (fromUrl as Screen) : 'INTRO';
  });
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
  // hasHolyWater/powerUps persist the same way as the currencies above -
  // localStorage bundle always, plus a Supabase saveProfile write when
  // logged in (see setHasHolyWater/setPowerUps below).
  const [hasHolyWater, setHasHolyWaterState] = useState<boolean>(() => getSavedReward('hasHolyWater') ?? false);
  const [powerUps, setPowerUpsState] = useState<Record<PowerUpType, number>>(
    () => getSavedReward('powerUps') ?? DEFAULT_POWER_UP_COUNTS
  );

  // Progression
  const [clearedIslands, setClearedIslands] = useState<string[]>([]);

  // 👤 NEW: State for the avatar URL from Supabase
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null); // 👈 NEW
  const [gradeLevel, setGradeLevel] = useState<string | null>(null);
  const [bibleVersionId, setBibleVersionIdState] = useState<number | null>(null);
  const [bibleLanguage, setBibleLanguageState] = useState<string | null>(null);

  const [isMuted, setIsMuted] = useState(true);
  const[currentTrack,setCurrentTrack]= useState ('/audio/crossroads.mp3');
  const [pendingBattleSpawn, setPendingBattleSpawn] = useState<Position | null>(null);
  const [pendingBattleSkipToRestored, setPendingBattleSkipToRestored] = useState<boolean>(false);

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
  const persistRewards = (
    newCupcakes: number,
    newCucumbers: number,
    newTickets: number,
    newHasHolyWater: boolean,
    newPowerUps: Record<PowerUpType, number>
  ) => {
    localStorage.setItem('sts_rewards', JSON.stringify({
      cupcakes: newCupcakes,
      cucumbers: newCucumbers,
      tickets: newTickets,
      hasHolyWater: newHasHolyWater,
      powerUps: newPowerUps,
    }));
  };

  // Internal helper to reset state without triggering another signOut.
  // Unconditional (not gated on currentScreen) and excludes currentScreen from
  // its own deps below - depending on it would give this callback a new
  // identity on every screen change, which would re-run the auth-listener
  // effect further down (it lists this callback in its deps) and re-subscribe
  // to Supabase - and onAuthStateChange re-fires immediately on every new
  // subscription, so a logged-out session would call this again right as any
  // screen change committed, snapping currentScreen straight back to INTRO.
  const cleanupAuthAndState = React.useCallback(() => {
    setIsLoggedIn(false);
    setUserId(null);
    setLoginMethod(null);
    setCurrentScreen('INTRO');

    // Fully clear out game state
    setIntroStep(0);
    setQuestObjectClicked(false);
    setIsSongbeastRehomed(false);
    setCupcakesState(0);
    setCucumbersState(0);
    setTicketsState(0);
    setClearedIslands([]);
    setHasHolyWaterState(false);
    setPowerUpsState(DEFAULT_POWER_UP_COUNTS);
    setFeedback('');

    emitGameLog("Player session ended. Game state cleared.", "system");
  }, [setCurrentScreen]);

  const loadOfflineFallback = () => {
    const savedRewards = localStorage.getItem('sts_rewards');
    if (savedRewards) {
      try {
        const { cupcakes: sCup, cucumbers: sCuc, tickets: sTix } = JSON.parse(savedRewards);
        setCupcakesState(sCup);
        setCucumbersState(sCuc);
        setTicketsState(sTix);
        // hasHolyWater/powerUps are left untouched here - this path only
        // runs when there's no Supabase profile to read from at all (not
        // logged in, or the fetch itself failed), so they just keep
        // whatever their own useState initializers already hydrated from
        // localStorage above.
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
        setBibleVersionIdState(profile.bible_version_id || null);
        setBibleLanguageState(profile.language || null);

        const loadedIslands = profile.clearedIslands || [];
        setClearedIslands(loadedIslands);

        const loadedHasHolyWater = profile.hasHolyWater ?? false;
        const loadedPowerUps = profile.powerUps ?? DEFAULT_POWER_UP_COUNTS;
        setHasHolyWaterState(loadedHasHolyWater);
        setPowerUpsState(loadedPowerUps);

        persistRewards(
          profile.cupcakes ?? 5,
          profile.cucumbers ?? 5,
          profile.tickets ?? 1,
          loadedHasHolyWater,
          loadedPowerUps
        );
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
    bible_version_id?: number;
    language?: string;
    hasHolyWater?: boolean;
    powerUps?: Record<PowerUpType, number>;
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
        persistRewards(next, cucumbers, tickets, hasHolyWater, powerUps);
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
        persistRewards(cupcakes, next, tickets, hasHolyWater, powerUps);
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
        persistRewards(cupcakes, cucumbers, next, hasHolyWater, powerUps);
        if (userId) {
          saveProfile(userId, { tickets: next });
        }
      });
      return next;
    });
  };

  const setHasHolyWater = (val: boolean) => {
    setHasHolyWaterState(val);
    queueMicrotask(() => {
      persistRewards(cupcakes, cucumbers, tickets, val, powerUps);
      if (userId) {
        saveProfile(userId, { hasHolyWater: val });
      }
    });
  };

  const setPowerUps = (
    val: Record<PowerUpType, number> | ((prev: Record<PowerUpType, number>) => Record<PowerUpType, number>)
  ) => {
    setPowerUpsState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      queueMicrotask(() => {
        persistRewards(cupcakes, cucumbers, tickets, hasHolyWater, next);
        if (userId) {
          saveProfile(userId, { powerUps: next });
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

  // Settings: verse translation/language - changing either re-triggers every
  // spot that reads bibleVersionId (QuestRiddle's verse-chunk fetch, the
  // Silencer battle's own verse fetch), so freshly-collected/battled verse
  // text reflects the new choice without needing a full reload.
  const setBibleVersionId = (id: number) => {
    setBibleVersionIdState(id);
    if (userId) saveProfile(userId, { bible_version_id: id });
  };

  const setBibleLanguage = (language: string) => {
    setBibleLanguageState(language);
    if (userId) saveProfile(userId, { language });
  };

  // Visual shaker helper
  const triggerShake = () => {
    setShakeTrigger(true);
    setTimeout(() => setShakeTrigger(false), 500);
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
    // Name already falls back to 'Traveler' in the UI. Use '4th' so the scenes take the live
    // Gloo question-generation path (the TK/2nd-3rd branches short-circuit to hardcoded questions).
    setGradeLevel('4th');
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
    setIsSongbeastRehomed(false);

    const resetCupcakes = 5;
    const resetCucumbers = 5;
    const resetTickets = 1;
    setCupcakesState(resetCupcakes);
    setCucumbersState(resetCucumbers);
    setTicketsState(resetTickets);
    setClearedIslands([]);

    setHasHolyWaterState(false);
    setPowerUpsState(DEFAULT_POWER_UP_COUNTS);
    setFeedback('');
    emitGameLog("Game values reset to start. Starting over...", "system");

    if (userId) {
      await saveProfile(userId, {
        cupcakes: resetCupcakes,
        cucumbers: resetCucumbers,
        tickets: resetTickets,
        clearedIslands: [],
        hasHolyWater: false,
        powerUps: DEFAULT_POWER_UP_COUNTS,
      });
    }
    persistRewards(resetCupcakes, resetCucumbers, resetTickets, false, DEFAULT_POWER_UP_COUNTS);
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
        isSongbeastRehomed,
        setIsSongbeastRehomed,

        cupcakes,
        setCupcakes,
        cucumbers,
        setCucumbers,
        tickets,
        setTickets,
        hasHolyWater,
        setHasHolyWater,
        powerUps,
        setPowerUps,

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

        avatarUrl,      // 👈 NEW
        characterPath,  // 👈 NEW
        displayName,
        gradeLevel,
        bibleVersionId,
        setBibleVersionId,
        bibleLanguage,
        setBibleLanguage,
        isMuted,
        setIsMuted,
        currentTrack,
        setCurrentTrack,
        pendingBattleSpawn,
        setPendingBattleSpawn,
        pendingBattleSkipToRestored,
        setPendingBattleSkipToRestored,
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
