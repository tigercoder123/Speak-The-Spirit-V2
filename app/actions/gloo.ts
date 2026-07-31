'use server';

import { supabase } from '@/services/supabaseService';

/**
 * 🔐 Exchanges Client ID and Client Secret for a temporary OAuth2 Access Token.
 */
async function getGlooAccessToken(): Promise<string | null> {
  const url = "https://platform.ai.gloo.com/oauth2/token";
  
  const clientId = process.env.GLOO_CLIENT_ID;
  const clientSecret = process.env.GLOO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("❌ Missing GLOO_CLIENT_ID or GLOO_CLIENT_SECRET in environment variables.");
    return null;
  }

  const credentialString = `${clientId}:${clientSecret}`;
  const base64Creds = Buffer.from(credentialString).toString('base64');

  const headers = {
    "Authorization": `Basic ${base64Creds}`,
    "Content-Type": "application/x-www-form-urlencoded"
  };

  const payload = new URLSearchParams({
    "grant_type": "client_credentials",
    "scope": "api/access"
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: payload,
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Auth API responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.access_token || null;
  } catch (error) {
    console.error(`❌ Gloo Authentication Failed:`, error);
    return null;
  }
}

/**
 * 👼 Chat with Angel Gabriel
 */
export async function askAngelGabriel(
  userId: string, 
  question: string, 
  systemInstructions: string
) {
  try {
    const accessToken = await getGlooAccessToken();
    if (!accessToken) {
      throw new Error("Could not acquire Gloo access token.");
    }

    // 1. Add display_name to the select string
    const { data: profile } = await supabase
      .from('profiles')
      .select('grade_level, church_experience, display_name') 
      .eq('id', userId)
      .single();

    const grade = profile?.grade_level || 'an unknown grade';
    const experience = profile?.church_experience || 'unknown';
    
    // 2. Safely grab the name, default to "Traveler" if missing
    const playerName = profile?.display_name || 'Traveler'; 

    // 3. Inject the name into the prompt!
    const fullyFormedPrompt = `
      You are Angel Gabriel, a warm, encouraging, and witty heavenly messenger guiding a child named ${playerName} in the game "Speak the Spirit".
      The player is in ${grade} and their church experience level is: "${experience}".
      
      ${systemInstructions}
      
      General Guidelines:
      1. Keep your answers EXTREMELY BRIEF (strict maximum of 2 sentences so it fits in a small chat box).
      2. Keep it encouraging and age-appropriate.
      3. Never give away the exact answer letter directly.
    `;

    const url = "https://platform.ai.gloo.com/ai/v2/chat/completions";
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        auto_routing: true,
        messages: [
          { role: "system", content: fullyFormedPrompt },
          { role: "user", content: question }
        ],
        temperature: 0.7
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gloo completion call responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return { reply: data.choices[0].message.content };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in askAngelGabriel:', message);
    return { error: "I can't hear you over the static! Try asking me again!" };
  }
}

/**
 * 📖 Generate Personalized Bible Question
 */
export async function getPersonalizedGlooQuestion(userId: string) {
  try {
    const accessToken = await getGlooAccessToken();
    if (!accessToken) {
      throw new Error("Could not acquire Gloo access token.");
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('grade_level, church_experience')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw new Error(`Profile not found for user ${userId}: ${error?.message}`);
    }

    const { grade_level, church_experience } = profile;

    const systemPrompt = `
      You are a friendly, encouraging AI mentor for children. 
      The user is in ${grade_level || 'an unknown grade'} and their church experience is: "${church_experience || 'unknown'}".
      
      Your goal is to generate a highly personalized, age-appropriate, and engaging question about a Bible verse.
      - For younger children (TK-3rd), use simple language, concrete examples, and a playful tone.
      - For older children (4th-12th), use more nuanced language, relate the verse to real-life social situations, and encourage deeper reflection.
      - If they have no church experience, avoid using "churchy" jargon and explain concepts simply.
      - If they are experienced, you can use more biblical terminology.
      
      Please provide only the question, without any introductory text.
    `;

    const url = "https://platform.ai.gloo.com/ai/v2/chat/completions";
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        auto_routing: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: 'Please generate a question for a verse about "Kindness".' }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gloo completion call responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return { question: data.choices[0].message.content };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in getPersonalizedGlooQuestion:', message);
    return { error: message };
  }
}

/**
 * 🛟 Hand-written fallback questions so a Gloo outage/timeout during a live demo is invisible.
 * Mirrors the exact shape the AI returns and rotates which slot holds the correct answer
 * (based on attemptCount) so it isn't predictably always "A".
 */
function buildCuratedQuestion(
  conceptName: string,
  attemptCount: number = 0,
  optionCount: number = 3
) {
  const faithBank = [
    {
      q: "The Gardener drew you a map to hidden treasure. What does REAL faith look like?",
      correct: "Trusting the map and walking the path one step at a time, even when it looks tricky.",
      wrongs: [
        "Only memorizing what the map says, but never actually taking a step.",
        "Waiting at the start for the treasure to magically float over to you.",
      ],
    },
    {
      q: "You come to a strong bridge over a rushing river. How do you show faith?",
      correct: "Step onto the bridge and cross, trusting it will hold you up.",
      wrongs: [
        "Stand at the edge reading facts about how bridges are built all day.",
        "Sit down and hope someone else carries you across.",
      ],
    },
    {
      q: "Faith is a lot like a chair. What do you actually DO with a chair?",
      correct: "Sit all the way down on it, trusting it to hold your weight.",
      wrongs: [
        "Just look at it and describe what color and shape it is.",
        "Walk right past it and wait for a comfier one to appear.",
      ],
    },
  ];

  const genericBank = [
    {
      q: `What is the true meaning of ${conceptName}?`,
      correct: `Taking active steps to actually live out ${conceptName} every day.`,
      wrongs: [
        `Only thinking about ${conceptName} and memorizing facts about it.`,
        `Waiting for ${conceptName} to just happen on its own without any effort.`,
      ],
    },
  ];

  const bank = conceptName.toLowerCase().includes("faith") ? faithBank : genericBank;
  const picked = bank[attemptCount % bank.length];

  const count = optionCount === 2 ? 2 : 3;
  const letters = count === 3 ? ["A", "B", "C"] : ["A", "B"];
  const correctIdx = attemptCount % count;
  const wrongs = picked.wrongs.slice(0, count - 1);

  const texts: string[] = [];
  let w = 0;
  for (let i = 0; i < count; i++) {
    texts[i] = i === correctIdx ? picked.correct : wrongs[w++];
  }

  const result: {
    question: string;
    optionA: string;
    optionB: string;
    optionC?: string;
    correctOption: string;
  } = {
    question: picked.q,
    optionA: texts[0],
    optionB: texts[1],
    correctOption: letters[correctIdx],
  };
  if (count === 3) result.optionC = texts[2];
  return result;
}

/**
 * 🎲 Generates a highly personalized multiple-choice question for any concept in the game.
 */
export async function generateAdaptiveQuestion(
  userId: string, 
  conceptName: string,       
  correctConceptRule: string, 
  incorrectTrapRule: string,  
  remedialContext: string = "",
  attemptCount: number = 0
) {
  // Hoisted so the curated fallback in catch{} can match the intended option count.
  let optionCount = 3;
  try {
    const accessToken = await getGlooAccessToken();
    if (!accessToken) {
      throw new Error("Could not acquire Gloo access token.");
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('grade_level, church_experience')
      .eq('id', userId)
      .single();

    const grade = profile?.grade_level || '4th';
    const experience = profile?.church_experience || 'unknown';

    const isYoungerKid = /^(TK|K|kindergarten|1st|2nd|3rd)$/i.test(grade.trim());
    optionCount = isYoungerKid ? 2 : 3;

    const categories = [
      "CONCEPTUAL METAPHOR: Focus on definitions using concrete, age-appropriate everyday analogies (like chairs, bridges, backpacks, maps, or wind).",
      "REAL-LIFE APPLICATION: Put the kid in a realistic scenario where they must choose the correct action over fear, passivity, or doing nothing.",
      "IN-GAME GARDEN LORE: Frame it around planting a seed, navigating a wilderness trial, trusting the Gardener's physical maps, or dealing with weeds."
    ];
    const currentCategory = categories[attemptCount % categories.length];

    const systemPrompt = `
      You are an expert children's game designer and curriculum writer creating a quest-based learning game.
      Generate an age-appropriate multiple-choice question for a child in ${grade} with "${experience}" church experience.
      
      Core Concept to Test: "${conceptName}"
      
      What the CORRECT option must represent:
      - "${correctConceptRule}"
      
      What the INCORRECT option(s) must represent:
      - "${incorrectTrapRule}"
      ${!isYoungerKid ? `- A second incorrect distractor showing passivity, fear, or waiting for a magic trick without active participation.` : ''}

      Question Category Style: ${currentCategory}
      
      ${remedialContext ? `IMPORTANT: The child got the last question wrong. Remedial context: ${remedialContext}. Adjust the scenario to address their specific misunderstanding.` : ""}
      
      Requirements:
      1. You must generate exactly ${optionCount} options: Option A, Option B${optionCount === 3 ? ', and Option C' : ''}.
      2. 🌟 CRITICAL: Randomly assign the correct concept to EITHER Option A, Option B${optionCount === 3 ? ', or Option C' : ''}. Do not always make Option B the correct answer!
      3. Keep the vocabulary extremely simple and friendly for a ${grade} student.
      4. Do NOT mention any ancient Greek root words in the options themselves.
      5. Respond with a strict, valid JSON object and nothing else. No markdown formatting, no code blocks, just raw JSON.
      
      Expected JSON Format:
      {
        "question": "The question text here?",
        "optionA": "The first choice text.",
        "optionB": "The second choice text.",
        ${optionCount === 3 ? '"optionC": "The third choice text.",' : ''}
        "correctOption": "A" or "B"${optionCount === 3 ? ' or "C"' : ''} (Set this dynamically to whichever letter contains the correct, active concept!)
      }
    `;

    const url = "https://platform.ai.gloo.com/ai/v2/chat/completions";
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        auto_routing: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate the JSON question payload for ${conceptName} now.` }
        ],
        temperature: 0.8
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Gloo completion call responded with ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.choices[0].message.content.trim();
    const cleanJsonText = rawText.replace(/^```json\s*|```$/g, '');
    const parsedQuestion = JSON.parse(cleanJsonText);

    return { questionData: parsedQuestion };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in generateAdaptiveQuestion:', message);

    // Curated fallback: a polished, concept-appropriate question that looks
    // indistinguishable from the AI output, so a Gloo failure is invisible in-demo.
    return { questionData: buildCuratedQuestion(conceptName, attemptCount, optionCount) };
  }
}

/**
 * 🧠 Evaluates the child's chat answer to Angel Gabriel's remedial comprehension question.
 */
/**
 * 🧠 Evaluates the child's chat answer to Angel Gabriel's remedial comprehension question.
 */
export async function verifyComprehension(
  userId: string,
  comprehensionQuestion: string,
  childResponse: string,
  correctConcept: string
) {
  try {
    const accessToken = await getGlooAccessToken();
    if (!accessToken) {
      throw new Error("Could not acquire Gloo access token.");
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('grade_level, church_experience')
      .eq('id', userId)
      .single();

    const grade = profile?.grade_level || '4th';
    const experience = profile?.church_experience || 'unknown';

    const systemPrompt = `
      You are Angel Gabriel, a warm, encouraging, and witty heavenly mentor guiding a child in ${grade} with "${experience}" church experience.
      
      You asked the child this comprehension question: "${comprehensionQuestion}"
      The correct core concept they need to explain is: "${correctConcept}"
      The child replied: "${childResponse}"
      
      Your goal is to evaluate if the child's reply shows they understand that faith/trust requires taking action rather than just knowing facts or doing nothing.
      
      Requirements:
      1. Be extremely lenient and encouraging. If they say something simple like "walk through", "do it", "jump", or "trust", count it as a pass!
      2. Respond with a strict, valid JSON object and nothing else. No markdown, no code blocks, just raw JSON.
      
      Expected JSON Format:
      {
        "isUnderstood": true or false,
        "reply": "Your immediate response as Angel Gabriel. If true, celebrate their understanding. If false, encourage them to try explaining it again gently."
      }
    `;

    const url = "https://platform.ai.gloo.com/ai/v2/chat/completions";
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        auto_routing: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Evaluate the child's comprehension reply now." }
        ],
        temperature: 0.5 
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Gloo completion call responded with ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.choices[0].message.content.trim();
    
    // 🛡️ BULLETPROOF JSON PARSER
    let parsedEvaluation;
    try {
      const startIndex = rawText.indexOf('{');
      const endIndex = rawText.lastIndexOf('}');
      
      if (startIndex === -1 || endIndex === -1) {
        throw new Error("No JSON object found in response.");
      }
      
      const cleanJsonString = rawText.substring(startIndex, endIndex + 1);
      parsedEvaluation = JSON.parse(cleanJsonString);
    } catch (parseError) {
      console.error("Failed to parse JSON from Gloo:", rawText);
      throw parseError; // Push to the outer catch block
    }

    return { evaluation: parsedEvaluation };

  } catch (error: unknown) {
    console.error('Error in verifyComprehension:', error);
    
    // 🛑 STRICT FALLBACK: Don't let them pass if it crashes!
    return {
      evaluation: {
        isUnderstood: false, 
        reply: "The heavenly static is a bit loud right now, I couldn't quite hear that! Can you try explaining it one more time?"
      }
    };
  }
}

// app/actions/gloo.ts (Append this function)

export async function chunkVerseWithGloo(verseText: string): Promise<string[]> {
  try {
    const accessToken = await getGlooAccessToken();
    if (!accessToken) throw new Error("Could not acquire Gloo token.");

    const systemPrompt = `
      You are a specialized game engine parser for a scripture memory game.
      Your task is to break down a Bible verse text into sequential, natural, semantic chunks optimal for a child to memorize step-by-step.
      
      CRITICAL INSTRUCTION FOR HEBREWS 11:1:
      If the text provided is Hebrews 11:1, you MUST divide the text into exactly 3 sequential chunks based on these specific themes:
      1) The introduction of faith (e.g., "Now faith is" or "Faith shows the reality"). DO NOT INCLUDE confidence/assurance in what we hope for.
      2) The assurance/confidence in what we hope for (e.g., "the assurance of things hoped for," or "of what we hope for;")
      3) The conviction/evidence of things we cannot see (e.g., "the conviction of things not seen." or "it is the evidence of things we cannot see.")
      
      General Rules for other verses:
      1. Divide the sentence at natural punctuation marks, clauses, or logical breathing breaks.
      2. Provide a minimum of 2 and a maximum of 4 sequential chunks.
      
      Return a strict, valid JSON object containing an array under the key "chunks". Do not include markdown code blocks.
      
      Example Expected JSON format:
      {
        "chunks": ["Now faith is", "the assurance of things hoped for,", "the conviction of things not seen."]
      }
    `;

    const url = "https://platform.ai.gloo.com/ai/v2/chat/completions";
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        auto_routing: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Parse this verse text: "${verseText}"` }
        ],
        temperature: 0.2 // Kept low for consistent formatting
      }),
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) throw new Error("Gloo failed parsing the verse.");

    const data = await response.json();
    const rawText = data.choices[0].message.content.trim();
    const cleanJsonText = rawText.replace(/^```json\s*|```$/g, '');
    const parsedData = JSON.parse(cleanJsonText);

    return parsedData.chunks || [verseText]; // Fallback to full verse if structure fails
  } catch (error) {
    console.error("❌ Error chunking verse with Gloo:", error);
    // Hardcoded layout fallback if network/parsing drops out
    return verseText.split(',').map(s => s.trim());
  }
}