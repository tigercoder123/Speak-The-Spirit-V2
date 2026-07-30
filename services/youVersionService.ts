'use server'; 

import { supabase } from '@/services/supabaseService'; 

export async function fetchVerseFromYouVersion(
  userId: string,
  passageId: string,
  /** The player's settings-selected translation (GameContext's
   * bibleVersionId) - pass it explicitly so a just-changed setting takes
   * effect immediately, instead of racing the Supabase write that persists
   * it. Omitted, falls back to whatever's already saved on the profile row. */
  explicitBibleVersionId?: number
): Promise<string | null> {

  let bibleVersionId = explicitBibleVersionId;

  if (bibleVersionId === undefined) {
    // 1. Changed .single() to .maybeSingle() so it doesn't crash if 0 rows are found
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('bible_version_id')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error("⚠️ Supabase warning (defaulting to 111):", error.message);
    }

    // 2. Safely grab the ID, or default to 111 if it fails or is NULL
    bibleVersionId = profile?.bible_version_id || 111;
  }

  const apiKey = process.env.YOUVERSION_API_KEY; 
  const url = `https://api.youversion.com/v1/bibles/${bibleVersionId}/passages/${passageId}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-YVP-App-Key': apiKey || '',
      },
      next: { revalidate: 86400 } 
    }); 

    if (!response.ok) {
      throw new Error(`YouVersion error: ${response.status} - ${await response.text()}`);
    }
    
    const data = await response.json();
    return data.content || "Text not found."; 
    
  } catch (err) {
    console.error("❌ Failed fetching from YouVersion API:", err);
    return null;
  }
}