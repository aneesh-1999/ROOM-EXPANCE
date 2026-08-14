import { Roommate } from './types';

export interface UserFeelingData {
  feeling: string;
  note?: string;
  timestamp: string;
  dateStr: string;
}

export interface DailyMotivationResponse {
  quote: string;
  author: string;
  reflection: string;
  dailyAffirmation: string;
  previousFeelingAcknowledged?: string;
}

// Key list of pre-defined feelings for quick user selection
export const COMMON_FEELINGS = [
  { id: 'homesick', label: 'Homesick', icon: '🏠', color: 'bg-amber-100 text-amber-900 border-amber-900' },
  { id: 'tired', label: 'Tired & Overworked', icon: '😴', color: 'bg-slate-100 text-slate-900 border-slate-900' },
  { id: 'lonely', label: 'Feeling Lonely', icon: '🌧️', color: 'bg-indigo-100 text-indigo-950 border-indigo-900' },
  { id: 'determined', label: 'Determined & Focused', icon: '🔥', color: 'bg-rose-100 text-rose-900 border-rose-900' },
  { id: 'hopeful', label: 'Hopeful & Proud', icon: '✨', color: 'bg-emerald-100 text-emerald-950 border-emerald-900' },
  { id: 'stressed', label: 'Financial Stress', icon: '💸', color: 'bg-orange-100 text-orange-900 border-orange-900' },
  { id: 'grateful', label: 'Grateful & Calm', icon: '🙏', color: 'bg-teal-100 text-teal-950 border-teal-900' },
];

// 1. Get active Gemini API Key
export function getGeminiApiKey(): string {
  const userSavedKey = localStorage.getItem('user_gemini_api_key');
  if (userSavedKey && userSavedKey.trim()) {
    return userSavedKey.trim();
  }

  // Fallback to Vite or Process env if configured
  const envViteKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (envViteKey && typeof envViteKey === 'string' && envViteKey.trim()) {
    return envViteKey.trim();
  }

  return '';
}

// 2. Check if AI Key is configured
export function hasGeminiApiKey(): boolean {
  return !!getGeminiApiKey();
}

// 3. Get today's YYYY-MM-DD string
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 4. Check if daily quote should be auto-triggered today
export function shouldTriggerDailyQuote(username: Roommate): boolean {
  const today = getTodayDateString();
  const lastShownDate = localStorage.getItem(`last_daily_quote_date_${username}`);
  
  // Only trigger once per day
  return lastShownDate !== today;
}

// 5. Mark quote as shown today
export function markDailyQuoteShown(username: Roommate): void {
  const today = getTodayDateString();
  localStorage.setItem(`last_daily_quote_date_${username}`, today);
}

// 6. Get previous feeling data
export function getPreviousUserFeeling(username: Roommate): UserFeelingData | null {
  try {
    const raw = localStorage.getItem(`last_user_feeling_${username}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// 7. Save user's current feeling for future AI context
export function saveUserFeeling(username: Roommate, feeling: string, note?: string): void {
  const data: UserFeelingData = {
    feeling,
    note: note?.trim() || undefined,
    timestamp: new Date().toISOString(),
    dateStr: getTodayDateString()
  };
  localStorage.setItem(`last_user_feeling_${username}`, JSON.stringify(data));
}

// High quality fallback motivation items in case network/rate limit happens
const FALLBACK_MOTIVATIONS: DailyMotivationResponse[] = [
  {
    quote: "Distance is not a obstacle; it is a testament to how far you are willing to go for those you love.",
    author: "Reflections for Overseas Journeys",
    reflection: "Living far from home and working hard every single day takes immense courage. Every sacrifice you make today is laying a solid foundation for your family's future.",
    dailyAffirmation: "I am strong enough to handle today's challenges because my purpose is bigger than my fatigue."
  },
  {
    quote: "The quiet struggles you endure in silence away from home will turn into the loudest triumphs of your life.",
    author: "Overseas Worker's Creed",
    reflection: "When loneliness creeps in, remember why you started this journey. You are building a life of dignity, financial freedom, and security for yourself and your loved ones.",
    dailyAffirmation: "Every step I take away from home is bringing me closer to the dreams I promised to fulfill."
  },
  {
    quote: "Hard work in a foreign land is not just labor; it is love expressed through sacrifice.",
    author: "Daily Inspiration",
    reflection: "It is normal to feel homesick or tired. Give yourself credit for how much you've already conquered. You are making your family back home prouder than you know.",
    dailyAffirmation: "I am resilient, capable, and surrounded by hope even on difficult days."
  }
];

// 8. Generate Daily AI Motivational Quote with Feeling Memory
export async function generateDailyMotivation(
  username: Roommate,
  customApiKey?: string
): Promise<DailyMotivationResponse> {
  const apiKey = customApiKey || getGeminiApiKey();
  const prevFeeling = getPreviousUserFeeling(username);

  if (!apiKey) {
    // Return curated fallback if no AI key present
    const randomIndex = Math.floor(Math.random() * FALLBACK_MOTIVATIONS.length);
    const fallback = FALLBACK_MOTIVATIONS[randomIndex];
    if (prevFeeling) {
      fallback.previousFeelingAcknowledged = prevFeeling.feeling;
      fallback.reflection = `Acknowleging how you felt previously (${prevFeeling.feeling}): ${fallback.reflection}`;
    }
    return fallback;
  }

  const prevFeelingText = prevFeeling 
    ? `Yesterday/Recently, the user logged that they felt: "${prevFeeling.feeling}"${prevFeeling.note ? ` with the note: "${prevFeeling.note}"` : ''}.`
    : `This is the user's first time logging their feelings.`;

  const promptText = `
You are an empathetic, deeply inspiring AI mentor and companion for ${username}. 
${username} is living far away from home and family, working hard in a foreign country, managing work shifts and expenses, and making sacrifices to build a better future.

User Feeling Context:
${prevFeelingText}

Your Task:
Generate a deeply moving, warm, and highly motivational daily message and quote.
Key Themes:
- Life, resilience, overcoming loneliness, dealing with fatigue or homesickness.
- Remind them that their hard work and distance from home is not in vain, and that they are building a bright future for their family.
- If previous feeling context is available, gently acknowledge how they felt previously with warmth and encouragement!
- Keep it uplifting, authentic, emotional, and empowering.

Format your response strictly as a JSON object with these keys:
{
  "quote": "A powerful 1-2 sentence inspirational quote tailored to working hard away from home.",
  "author": "Name of thinker/philosopher or inspirational title",
  "reflection": "A warm, personal 2-3 sentence message speaking directly to ${username}. (Acknowledge past feeling if provided).",
  "dailyAffirmation": "A short 1-line empowering mantra for today"
}
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: promptText }]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                quote: { type: "STRING" },
                author: { type: "STRING" },
                reflection: { type: "STRING" },
                dailyAffirmation: { type: "STRING" }
              },
              required: ["quote", "author", "reflection", "dailyAffirmation"]
            }
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!jsonText) {
      throw new Error('No text returned from Gemini API');
    }

    const parsed: DailyMotivationResponse = JSON.parse(jsonText);
    if (prevFeeling) {
      parsed.previousFeelingAcknowledged = prevFeeling.feeling;
    }
    return parsed;

  } catch (err) {
    console.warn('Failed to fetch AI daily motivation, using fallback', err);
    const randomIndex = Math.floor(Math.random() * FALLBACK_MOTIVATIONS.length);
    const fallback = { ...FALLBACK_MOTIVATIONS[randomIndex] };
    if (prevFeeling) {
      fallback.previousFeelingAcknowledged = prevFeeling.feeling;
      fallback.reflection = `Regarding your recent feeling of being "${prevFeeling.feeling}": ${fallback.reflection}`;
    }
    return fallback;
  }
}
