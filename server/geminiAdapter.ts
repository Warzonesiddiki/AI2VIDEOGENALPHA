/**
 * Ternfall Studio - Server-Side Gemini API Adapter
 * Uses @google/genai TypeScript SDK. Server-side only; secrets never leak to client.
 * Provides resilient fallbacks when API key is not configured or network is offline.
 */

import { GoogleGenAI } from '@google/genai';

export interface GenerationResult<T> {
  success: boolean;
  isAiGenerated: boolean;
  data: T;
  providerNotice?: string;
  tokensUsed?: number;
}

export class GeminiAdapter {
  private client: GoogleGenAI | null = null;
  private hasValidKey = false;

  constructor() {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== 'MY_GEMINI_API_KEY' && key.trim().length > 10) {
      try {
        this.client = new GoogleGenAI({ apiKey: key.trim() });
        this.hasValidKey = true;
      } catch (err) {
        console.warn('[GeminiAdapter] Failed to initialize GoogleGenAI client:', err);
      }
    }
  }

  public isConfigured(): boolean {
    return this.hasValidKey && this.client !== null;
  }

  /**
   * Generates or expands an outline beat sheet using Gemini 2.5 Flash.
   */
  public async generateOutline(params: {
    workingTitle: string;
    logline: string;
    characters: string[];
    location: string;
    canonNotes?: string;
  }): Promise<GenerationResult<{ beats: Array<{ name: string; snippet: string }> }>> {
    if (!this.client || !this.hasValidKey) {
      return {
        success: true,
        isAiGenerated: false,
        data: {
          beats: [
            { name: 'Cold Open (00:00)', snippet: 'Analog pressure needle twitches eight times on Basin 3 wall.' },
            { name: 'Premise (00:25)', snippet: 'Rhea Mistry investigates silence of official emergency siren network.' },
            { name: 'Inciting Failure (01:30)', snippet: 'Digital SCADA panel falsely reports gate open; lower sluice jammed.' },
            { name: 'Human Encounter (03:00)', snippet: 'Mara Ilyan hammers on trapped maintenance hatch with pipe wrench.' },
            { name: 'First Evidence (05:00)', snippet: 'The Still turn toward rhythmic pump shudder rather than shouting.' },
            { name: 'Moral Choice (07:00)', snippet: 'Opening upper bypass sacrifices lower municipal blueprint archive.' },
            { name: 'Action & Consequence (09:30)', snippet: 'Manual gate shifted; night mechanics saved; blueprint room floods.' },
            { name: 'Aftermath (12:30)', snippet: 'Rhea sketches paper route from memory; faint radio call from Kabir.' },
            { name: 'Cliffhanger (14:20)', snippet: 'Second eight-beat pulse begins four miles north in the blackout.' },
          ],
        },
        providerNotice: 'Gemini API not configured. Provided verified canonical 9-beat template.',
      };
    }

    try {
      const prompt = `You are the lead narrative architect for the original survival thriller "The Quiet Hours: Ternfall".
Generate a 9-beat dramatic outline for a 15-minute episode.
Title: "${params.workingTitle}"
Logline: "${params.logline}"
Characters: ${params.characters.join(', ')}
Location: ${params.location}
Canon Context: ${params.canonNotes || 'Infection spreads only by contact; The Still respond to mechanical pump pulses; no talking zombies; no airborne virus.'}

Output JSON format:
{
  "beats": [
    {"name": "Cold Open (00:00)", "snippet": "..."},
    ...
  ]
}`;

      const response = await this.client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      });

      const text = response.text || '{}';
      const parsed = JSON.parse(text);

      return {
        success: true,
        isAiGenerated: true,
        data: parsed,
      };
    } catch (err: any) {
      console.warn('[GeminiAdapter] generateOutline API call failed, using safe fallback:', err.message);
      return {
        success: false,
        isAiGenerated: false,
        data: { beats: [] },
        providerNotice: `Provider error: ${err.message}`,
      };
    }
  }

  /**
   * Enhances visual prompts for image generation with silhouette and lighting constraints.
   */
  public async enhanceVisualPrompt(params: {
    shotDescription: string;
    framing: string;
    characterAnchor?: string;
  }): Promise<GenerationResult<{ prompt: string; negativePrompt: string }>> {
    const basePrompt = `Editorial 2D illustration, ${params.framing} composition, ${params.shotDescription}. Estuary teal (#0D9488), slate gray (#334155), and sodium-amber lighting. Hand-inked linework, layered paper grain texture, high narrative depth.`;
    const negativePrompt = 'hyper-saturated neon, glossy 3D pastel, anime big eyes, gore shock, yellow beanie mascot, modern touchscreens';

    return {
      success: true,
      isAiGenerated: false,
      data: {
        prompt: params.characterAnchor ? `${basePrompt} Character visual anchor: ${params.characterAnchor}.` : basePrompt,
        negativePrompt,
      },
    };
  }
}

export const geminiAdapter = new GeminiAdapter();
