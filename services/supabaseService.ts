import { createClient } from '@supabase/supabase-js';
import { addLog as emitGameLog } from '../utils/gameEvents';
import { DEFAULT_POWER_UP_COUNTS, type PowerUpType } from '../config/powerUpConfig';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface PlayerProfile {
  id: string;
  display_name?: string;
  avatar_url?: string;
  language?: string;
  bible_version_id?: number;
  grade_level?: string;
  church_experience?: string;
  cupcakes: number;
  cucumbers: number;
  tickets: number;
  clearedIslands: string[];
  hasHolyWater?: boolean;
  powerUps?: Record<PowerUpType, number>;
}

export interface ProfileUpdate {
  display_name?: string;
  avatar_url?: string;
  language?: string;
  bible_version_id?: number;
  grade_level?: string;
  church_experience?: string;
  cupcakes?: number;
  cucumbers?: number;
  tickets?: number;
  clearedIslands?: string[];
  hasHolyWater?: boolean;
  powerUps?: Record<PowerUpType, number>;
}

export const supabaseService = {
  async fetchProfile(userId: string): Promise<PlayerProfile | null> {
    try {
      emitGameLog("Fetching player profile from Supabase...", "system");
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile from Supabase:", error.message, error.details);
        emitGameLog(`Database error: ${error.message}. ${error.details || ''}`, "system");
        throw error;
      }

      if (data) {
        emitGameLog(`Profile loaded successfully. Cleared islands: ${data.clearedIslands?.length > 0 ? data.clearedIslands.join(', ') : 'None'}.`, "system");
        return data as PlayerProfile;
      }

      // Create new profile row in Supabase if not found
      emitGameLog("Creating new player profile on Supabase...", "system");
      const newProfile: PlayerProfile = {
        id: userId,
        cupcakes: 5,
        cucumbers: 5,
        tickets: 1,
        clearedIslands: [],
        hasHolyWater: false,
        powerUps: DEFAULT_POWER_UP_COUNTS,
      };

      const { error: insertError } = await supabase
        .from('profiles')
        .insert([newProfile]);

      if (insertError) {
        console.error("Error creating profile in Supabase:", insertError.message, insertError.details);
        emitGameLog(`Database error: ${insertError.message}. ${insertError.details || ''}`, "system");
        throw insertError;
      }

      emitGameLog("New profile created and initialized.", "system");
      return newProfile;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Supabase profile fetch exception:", message);
      emitGameLog(`Database exception occurred: ${message}.`, "system");
      throw err;
    }
  },

  async saveProfile(userId: string, updatedFields: ProfileUpdate): Promise<void> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updatedFields)
        .eq('id', userId);

      if (error) {
        console.error("Error updating profile in Supabase:", error.message, error.details);
        emitGameLog(`Failed to sync with Supabase: ${error.message}. ${error.details || ''}`, "system");
        throw error;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Supabase profile update exception:", message);
      throw err;
    }
  },
};
