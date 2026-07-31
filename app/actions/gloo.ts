'use server';

import { supabase } from '@/services/supabaseService';

// Cached across calls within the same warm server instance so repeat Gloo
// calls (a single battle round can fire several - response choices,
// temptation line, resilience thought, wrong-answer moment) skip the OAuth2
// round trip entirely once a valid token is in hand, instead of paying for
// it sequentially before every single completion request.
let cachedAccessToken: string | null = null;
let cachedTokenExpiresAt = 0; // epoch ms
// Dedupes concurrent callers - e.g. submitAnswer's correct-answer path
// fires off its response-choices and temptation-line generations back to
// back without awaiting either - so a cold cache doesn't trigger a
// redundant parallel token request for each of them.
let pendingTokenRequest: Promise<string | null> | null = null;

/**
 * 🔐 Exchanges Client ID and Client Secret for a temporary OAuth2 Access Token.
 */
async function getGlooAccessToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedAccessToken && now < cachedTokenExpiresAt) {
    return cachedAccessToken;
  }
  if (pendingTokenRequest) {
    return pendingTokenRequest;
  }

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

  pendingTokenRequest = (async () => {
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
      const token: string | null = data.access_token || null;
      if (token) {
        cachedAccessToken = token;
        // expires_in is in seconds per the OAuth2 client_credentials spec -
        // refresh a little early so a near-expiry cached token is never
        // handed to a caller about to use it. Falls back to a conservative
        // 5-minute lifetime if the response omits it.
        const expiresInSeconds = typeof data.expires_in === 'number' ? data.expires_in : 300;
        cachedTokenExpiresAt = now + Math.max(0, expiresInSeconds - 30) * 1000;
      }
      return token;
    } catch (error) {
      console.error(`❌ Gloo Authentication Failed:`, error);
      return null;
    } finally {
      pendingTokenRequest = null;
    }
  })();

  return pendingTokenRequest;
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
      signal: AbortSignal.timeout(10000)
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

interface NormalizedQuestion {
  question: string;
  optionA: string;
  optionB: string;
  optionC?: string;
  correctOption: 'A' | 'B' | 'C';
}

/**
 * 🧹 Normalizes whatever JSON the AI returned into a canonical question shape with a guaranteed-valid
 * `correctOption`. The model frequently ignores our key names (uses correctAnswer/answer/etc.) or
 * puts the answer TEXT instead of a letter — every consumer (answer check, hint, display) depends on
 * `correctOption` being a real letter that points to an existing option, so we reconcile it here.
 * Returns null if the payload can't be salvaged (caller then falls back to a curated question).
 */
function normalizeQuestionData(raw: unknown, optionCount: number): NormalizedQuestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const str = (v: unknown) => (v == null ? '' : String(v).trim());
  const question = str(r.question ?? r.prompt);
  const optionA = str(r.optionA ?? r.option_a ?? r.a);
  const optionB = str(r.optionB ?? r.option_b ?? r.b);
  const optionCVal = r.optionC ?? r.option_c ?? r.c;
  const optionC = optionCVal != null ? str(optionCVal) : undefined;

  if (!question || !optionA || !optionB) return null;
  if (optionCount === 3 && !optionC) return null; // wanted 3 options but the model only gave 2

  // Pull the correct answer from any of the keys the model tends to use.
  const rawCorrect = str(
    r.correctOption ?? r.correctAnswer ?? r.correct_option ?? r.answer ?? r.correct
  );
  if (!rawCorrect) return null;

  // Resolve it to a canonical letter: a bare letter, an "Option B" string, or the answer text.
  let letter = '';
  const upper = rawCorrect.toUpperCase();
  const optionMatch = upper.match(/\b(?:OPTION\s*)?([ABC])\b/);
  if (['A', 'B', 'C'].includes(upper)) {
    letter = upper;
  } else if (optionMatch) {
    letter = optionMatch[1];
  } else {
    const lc = rawCorrect.toLowerCase();
    if (optionA.toLowerCase() === lc || lc.includes(optionA.toLowerCase())) letter = 'A';
    else if (optionB.toLowerCase() === lc || lc.includes(optionB.toLowerCase())) letter = 'B';
    else if (optionC && (optionC.toLowerCase() === lc || lc.includes(optionC.toLowerCase()))) letter = 'C';
  }

  if (!letter) return null;
  if (letter === 'C' && !optionC) return null; // points at a non-existent option

  const result: NormalizedQuestion = {
    question,
    optionA,
    optionB,
    correctOption: letter as 'A' | 'B' | 'C',
  };
  if (optionC) result.optionC = optionC;
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
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`Gloo completion call responded with ${response.status}`);
    }

    const data = await response.json();
    const rawText = String(data?.choices?.[0]?.message?.content ?? '').trim();

    // Bulletproof extraction: grab from the first "{" to the last "}" so stray prose/markdown
    // around the JSON doesn't break the parse (same approach as verifyComprehension).
    const startIndex = rawText.indexOf('{');
    const endIndex = rawText.lastIndexOf('}');
    if (startIndex === -1 || endIndex === -1) {
      throw new Error('No JSON object found in Gloo question response.');
    }
    const parsedQuestion = JSON.parse(rawText.substring(startIndex, endIndex + 1));

    // Normalize + validate so every scene gets a guaranteed-valid correctOption.
    const normalized = normalizeQuestionData(parsedQuestion, optionCount);
    if (!normalized) {
      throw new Error('Gloo question failed shape/answer-key validation.');
    }

    return { questionData: normalized };

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
      signal: AbortSignal.timeout(10000)
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

/**
 * 🗣️ Generates 3 tone-varied response lines for the Silencer battle's CHOICE
 * screen - one each for gentle/firm/warm, all carrying the same "you don't
 * need the Silencer's gear" message, grounded specifically in the verse the
 * player is currently memorizing, and specific to whichever gear piece is
 * being removed this round. Also generates, in this SAME call:
 * 1. The muted Songbeast's own short thought-bubble reaction to each of the
 *    3 lines, so the matching reaction is already in hand the instant the
 *    player picks one (see components/battle/ThoughtBubble.tsx).
 * 2. The Silencer's own tone-keyed comeback line reacting to that exact
 *    line, used as the RESILENCE beat's temptation line once the player's
 *    tone is known (see components/battle/TemptationLine.tsx and
 *    hooks/useSilencerBattle.ts's selectResponse) - so the Silencer's
 *    re-silence taunt always answers what the player actually just said,
 *    instead of an independent, unrelated line from a second Gloo call.
 * All in services/responseChoicesService.ts - no second Gloo call, no wait.
 */
export async function generateSilencerResponseChoices(
  gearPieceName: string,
  gearPieceDescription: string,
  gearPieceLie: string,
  verseReference: string,
  verseText: string
) {
  try {
    const accessToken = await getGlooAccessToken();
    if (!accessToken) {
      throw new Error("Could not acquire Gloo access token.");
    }

    const systemPrompt = `
      You are a biblically-grounded creative writer for a children's Bible game called "Speak the Spirit".

      In this game, God is called "the Gardener" - always use "the Gardener" instead of "God", "Lord",
      "Jesus", or any other name/title for God, in every line you write below.

      In this game, a Songbeast has been silenced by an antagonist called the Silencer, who has fitted it
      with oppressive gear, and cannot speak. The player just answered a Bible memory challenge correctly
      and is about to remove one piece of that gear: the ${gearPieceName} (${gearPieceDescription}).

      The Songbeast isn't wearing the ${gearPieceName} just because it looks nice - it's still wearing it
      because the Silencer convinced it of this specific lie:
      "${gearPieceLie}"

      The verse the player is memorizing this battle is ${verseReference}: "${verseText}"

      Write exactly 3 short lines of dialogue the player could say to the Songbeast as they remove this
      piece. Every line must:
      1. Directly speak into and dismantle the SPECIFIC lie above - not a generic "you don't need the
         gear" message. Each line should make clear why that exact lie isn't true.
      2. Use the verse above as the reason the lie isn't true - paraphrase or echo its actual words,
         phrases, or ideas (not just a generic biblical theme) to show specifically how it counters the
         lie. A child should be able to tell this line came from THIS verse specifically.
      3. Specifically reference the ${gearPieceName} being removed.
      4. Be one short sentence, simple and age-appropriate.

      The 3 lines differ in delivery tone AND in which part of the lie/verse connection they lean on, so
      they don't just restate the same point 3 times:
      - "gentle": gentle and encouraging
      - "firm": firm and bold
      - "warm": warm and affirming

      For EACH of the 3 lines, also write the Songbeast's own brief, unspoken interior thought reacting
      to hearing that EXACT line - it cannot speak, only think. Each reaction must:
      1. React specifically to the content of its own matching line above, echoing its emotional register
         back (not a generic reaction to the tone label alone).
      2. Be interior and fragmentary, NOT a full spoken sentence - a stray thought, not dialogue. Ellipses
         are fine.
      3. Be EXTREMELY short: 3 to 6 words maximum. This is a hard requirement.

      For EACH of the 3 lines, ALSO write the Silencer's own one-line comeback, spoken moments later as it
      puts a piece of gear back onto the Songbeast, directly rebutting THAT EXACT line the player just
      said. Each comeback must:
      1. Directly reference or twist something specific the player's matching line just said - not a
         generic taunt, a rebuttal to those exact words.
      2. Try to pull the Songbeast back toward believing the lie above again (e.g. casting doubt on what
         the player just said, or claiming it's not enough) - never anything violent, scary, or genuinely
         frightening for a child.
      3. Be one short sentence.
      4. Not include quotation marks around the line itself - those are added separately.

      Respond with a strict, valid JSON object and nothing else. No markdown, no code blocks, just raw JSON.

      Expected JSON format:
      {
        "gentle": { "line": "the gentle, encouraging line", "reaction": "Songbeast's short thought reacting to it", "rebuttal": "the Silencer's comeback to this exact line" },
        "firm": { "line": "the firm, bold line", "reaction": "Songbeast's short thought reacting to it", "rebuttal": "the Silencer's comeback to this exact line" },
        "warm": { "line": "the warm, affirming line", "reaction": "Songbeast's short thought reacting to it", "rebuttal": "the Silencer's comeback to this exact line" }
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
          { role: "user", content: `Generate the 3 response lines, matching Songbeast reactions, and matching Silencer comebacks for the ${gearPieceName} now.` }
        ],
        temperature: 0.8,
        // The whole JSON payload is 9 short fields (3 one-sentence lines, 3
        // three-to-six-word reactions, 3 one-sentence comebacks) - comfortably
        // under 700 tokens even generously. Caps worst-case generation time if
        // the model rambles, without any risk of truncating a well-formed response.
        max_tokens: 700
      }),
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) {
      throw new Error(`Gloo completion call responded with ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.choices[0].message.content.trim();

    const startIndex = rawText.indexOf('{');
    const endIndex = rawText.lastIndexOf('}');
    if (startIndex === -1 || endIndex === -1) {
      throw new Error("No JSON object found in response.");
    }
    const parsed = JSON.parse(rawText.substring(startIndex, endIndex + 1));

    if (!parsed.gentle?.line || !parsed.firm?.line || !parsed.warm?.line) {
      throw new Error("Gloo response is missing one or more tones' lines.");
    }
    if (!parsed.gentle?.reaction || !parsed.firm?.reaction || !parsed.warm?.reaction) {
      throw new Error("Gloo response is missing one or more tones' reactions.");
    }
    if (!parsed.gentle?.rebuttal || !parsed.firm?.rebuttal || !parsed.warm?.rebuttal) {
      throw new Error("Gloo response is missing one or more tones' rebuttals.");
    }

    return {
      lines: {
        gentle: String(parsed.gentle.line),
        firm: String(parsed.firm.line),
        warm: String(parsed.warm.line),
      },
      reactions: {
        gentle: String(parsed.gentle.reaction),
        firm: String(parsed.firm.reaction),
        warm: String(parsed.warm.reaction),
      },
      rebuttals: {
        gentle: String(parsed.gentle.rebuttal),
        firm: String(parsed.firm.rebuttal),
        warm: String(parsed.warm.rebuttal),
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in generateSilencerResponseChoices:', message);
    return { error: message };
  }
}

/**
 * 💭 Generates the muted Songbeast's brief interior thought for the
 * re-silence beat - reacting to the Silencer's temptation line's content as
 * its own gear goes back on, wavering back toward doubt. The Songbeast is
 * muted, so this is never spoken aloud, only thought (see
 * components/battle/ThoughtBubble.tsx and services/resilenceThoughtService.ts).
 */
export async function generateSongbeastResilenceThought(temptationLineContent: string) {
  try {
    const accessToken = await getGlooAccessToken();
    if (!accessToken) {
      throw new Error("Could not acquire Gloo access token.");
    }

    const systemPrompt = `
      You are a biblically-grounded creative writer for a children's Bible game called "Speak the Spirit".

      In this game, God is called "the Gardener" - always use "the Gardener" instead of "God", "Lord",
      "Jesus", or any other name/title for God, if you reference God at all below.

      In this game, a Songbeast has been silenced by an antagonist called the Silencer and cannot speak.
      The Silencer just said this to the Songbeast, while putting a piece of its gear back on:
      "${temptationLineContent}"

      Write the Songbeast's own brief, unspoken interior thought in response - it cannot speak, only
      think. The thought must:
      1. React specifically to what the Silencer just said above, wavering back toward doubt.
      2. Be interior and fragmentary, NOT a full spoken sentence - a stray thought, not dialogue.
         Ellipses are fine.
      3. Be EXTREMELY short: 3 to 6 words maximum. This is a hard requirement.
      4. Never be violent, scary, or genuinely frightening for a child - just a quiet flicker of doubt.

      Respond with a strict, valid JSON object and nothing else. No markdown, no code blocks, just raw JSON.

      Expected JSON format:
      {
        "thought": "the Songbeast's short interior thought"
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
          { role: "user", content: "Generate the Songbeast's interior thought now." }
        ],
        temperature: 0.8
      }),
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) {
      throw new Error(`Gloo completion call responded with ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.choices[0].message.content.trim();

    const startIndex = rawText.indexOf('{');
    const endIndex = rawText.lastIndexOf('}');
    if (startIndex === -1 || endIndex === -1) {
      throw new Error("No JSON object found in response.");
    }
    const parsed = JSON.parse(rawText.substring(startIndex, endIndex + 1));

    if (!parsed.thought) {
      throw new Error("Gloo response is missing the thought.");
    }

    return { thought: String(parsed.thought) };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in generateSongbeastResilenceThought:', message);
    return { error: message };
  }
}

/**
 * 😈 Generates the Silencer's gloating line for a WRONG-answer moment - said
 * as it puts a piece of gear back onto the Songbeast because the player just
 * missed a Bible memory question - together with the muted Songbeast's own
 * brief interior thought reacting to it, wavering toward doubt. Both are
 * generated in this single call (see services/wrongAnswerMomentService.ts
 * and components/battle/ThoughtBubble.tsx) so the reply is already in hand
 * the instant the setback beat needs it - no second call, no wait.
 */
export async function generateSilencerWrongAnswerMoment(
  gearPieceName: string,
  gearPieceDescription: string
) {
  try {
    const accessToken = await getGlooAccessToken();
    if (!accessToken) {
      throw new Error("Could not acquire Gloo access token.");
    }

    const systemPrompt = `
      You are a biblically-grounded creative writer for a children's Bible game called "Speak the Spirit".

      In this game, God is called "the Gardener" - always use "the Gardener" instead of "God", "Lord",
      "Jesus", or any other name/title for God, if you reference God at all below.

      In this game, a Songbeast has been silenced by an antagonist called the Silencer and cannot speak.
      The player just answered a Bible memory challenge WRONG, and the Silencer capitalizes on the
      mistake by putting a piece of its gear back onto the Songbeast: the ${gearPieceName}
      (${gearPieceDescription}).

      Write exactly ONE short line of dialogue the Silencer says as it does this, gloating over the
      player's mistake. The line must:
      1. Specifically reference the ${gearPieceName} going back on.
      2. Read as gloating or taunting about the wrong answer - never anything violent, scary, or
         genuinely frightening for a child.
      3. Be one short sentence.
      4. Not include quotation marks around the line itself - those are added separately.

      Then write the Songbeast's own brief, unspoken interior thought reacting to that exact line - it
      cannot speak, only think. The thought must:
      1. React specifically to what the Silencer just said above, wavering toward doubt or
         discouragement - the miss went the Silencer's way, so this should NOT be an upbeat or
         defiant thought.
      2. Be interior and fragmentary, NOT a full spoken sentence - a stray thought, not dialogue.
         Ellipses are fine.
      3. Be EXTREMELY short: 3 to 6 words maximum. This is a hard requirement.

      Respond with a strict, valid JSON object and nothing else. No markdown, no code blocks, just raw JSON.

      Expected JSON format:
      {
        "silencerLine": "the Silencer's gloating line, without quotation marks",
        "songbeastThought": "the Songbeast's short interior thought"
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
          { role: "user", content: `Generate the Silencer's gloating line and the Songbeast's reply for the ${gearPieceName} now.` }
        ],
        temperature: 0.8
      }),
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) {
      throw new Error(`Gloo completion call responded with ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.choices[0].message.content.trim();

    const startIndex = rawText.indexOf('{');
    const endIndex = rawText.lastIndexOf('}');
    if (startIndex === -1 || endIndex === -1) {
      throw new Error("No JSON object found in response.");
    }
    const parsed = JSON.parse(rawText.substring(startIndex, endIndex + 1));

    if (!parsed.silencerLine || !parsed.songbeastThought) {
      throw new Error("Gloo response is missing the line or the thought.");
    }

    return {
      silencerLine: String(parsed.silencerLine),
      songbeastThought: String(parsed.songbeastThought),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in generateSilencerWrongAnswerMoment:', message);
    return { error: message };
  }
}

/**
 * 🔀 Generates wrong-answer options for a single verse word/token, in the
 * player's own verse language - used for the Silencer battle's WORD_BANK and
 * DROPDOWN challenges whenever that language isn't English, since the game's
 * static distractor bank (config/silencerBattleRounds.ts) is English-only
 * vocabulary and would otherwise mix English wrong answers into an
 * otherwise-foreign-language word bank/dropdown (see
 * services/distractorService.ts for the timeout/fallback wrapper around this).
 */
export async function generateWordDistractors(
  word: string,
  languageName: string,
  count: number,
  verseContext: string
) {
  try {
    const accessToken = await getGlooAccessToken();
    if (!accessToken) {
      throw new Error("Could not acquire Gloo access token.");
    }

    const systemPrompt = `
      You are generating wrong-answer options for a Bible memory-verse word game, entirely in ${languageName}.

      The verse (already in ${languageName}) is: "${verseContext}"
      The correct word/token from that exact verse is: "${word}"

      Write exactly ${count} short, plausible-but-WRONG alternative word(s) or token(s), in ${languageName},
      that a player might mistakenly pick instead of "${word}" for this exact spot in the verse. Each
      wrong option must:
      1. Be written in ${languageName}, using its own native script - never English or any other language.
      2. Be roughly the same length/type as "${word}" (a single word or short token, not a full phrase).
      3. Be clearly different from "${word}" and from each other.
      4. NOT also correctly fit this exact spot - it must read as a plausible mistake, not another right answer.

      Respond with a strict, valid JSON object and nothing else. No markdown, no code blocks, just raw JSON.

      Expected JSON format:
      { "distractors": ["wrong option 1", "wrong option 2"] }
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
          { role: "user", content: `Generate ${count} wrong options for "${word}" now.` }
        ],
        temperature: 0.8,
        max_tokens: 200
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`Gloo completion call responded with ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.choices[0].message.content.trim();

    const startIndex = rawText.indexOf('{');
    const endIndex = rawText.lastIndexOf('}');
    if (startIndex === -1 || endIndex === -1) {
      throw new Error("No JSON object found in response.");
    }
    const parsed = JSON.parse(rawText.substring(startIndex, endIndex + 1));

    if (!Array.isArray(parsed.distractors) || parsed.distractors.length === 0) {
      throw new Error("Gloo response is missing distractors.");
    }

    return { distractors: parsed.distractors.map((d: unknown) => String(d)) };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in generateWordDistractors:', message);
    return { error: message };
  }
}

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