import { buildStoryOutline } from '../src/core/storyCraft.ts';
/**
 * Ternfall Studio - Server-Side Gemini API Adapter
 * Uses @google/genai TypeScript SDK. Server-side only; secrets never leak to client.
 * Provides explicitly unreviewed local planning scaffolds without a configured key; paid execution remains disabled.
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

  constructor(key = process.env.GEMINI_API_KEY) {
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
   * Returns a local editorial scaffold without a key. Configured paid generation remains disabled.
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
        data: buildStoryOutline(params),
        providerNotice: 'Local editorial scaffold only: not AI-generated, not a finished script and not verified or approved. No provider request was sent.',

      };
    }

    // Do not make billable calls before a durable authorization/reservation service exists.
    return {
      success: false,
      isAiGenerated: false,
      data: { beats: [] },
      providerNotice: 'Paid generation is disabled pending scoped operator approval and transactional spend reservations. No provider request was sent.',
    };
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
