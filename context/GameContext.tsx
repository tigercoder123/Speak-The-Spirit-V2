'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { addLog as emitGameLog } from '../utils/gameEvents';
import { supabase, supabaseService } from '../services/supabaseService';
import type { Position } from '../hooks/usePlayerWalker';

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
  const [hasHolyWater, setHasHolyWater] = useState<boolean>(false);

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
  const persistRewards = (newCupcakes: number, newCucumbers: number, newTickets: number) => {
    localStorage.setItem('sts_rewards', JSON.stringify({
      cupcakes: newCupcakes,
      cucumbers: newCucumbers,
      tickets: newTickets,
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
    setHasHolyWater(false);
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
    bible_version_id?: number;
    language?: string;
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
      } else {
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
    try {
      await supabase.auth.signOut();
      // cleanupAuthAndState is called automatically via onAuthStateChange
    } catch (err) {
      console.error("Error during sign out:", err);
      cleanupAuthAndState();
    }
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
