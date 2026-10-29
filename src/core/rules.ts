/**
 * Ternfall Studio - Core Rules & Calculations
 * Pure domain logic decoupled from UI for strict determinism and unit testing.
 */

export interface WordCountResult {
  wordCount: number;
  characterCount: number;
  targetWpm: number;
  estimatedDurationSeconds: number;
  estimatedDurationFormatted: string; // "MM:SS"
  isWithinTarget15Min: boolean; // Target 15 min ~2,100 to 2,400 words at 145 wpm
  pacingNote: string;
}

/**
 * Calculates words from narration text, handling punctuation, newlines, and unicode.
 */
export function calculateWordCount(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  // Strip stage directions like [Beat 01], (whispering), etc. for spoken count
  const spokenTextOnly = text
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .trim();

  if (!spokenTextOnly) return 0;
  const words = spokenTextOnly.split(/\s+/).filter(Boolean);
  return words.length;
}

/**
 * Calculates estimated spoken duration based on word count and words per minute (WPM).
 * Master rule: Default 145 WPM (140-160 allowed range).
 */
export function calculateNarrationPacing(
  wordCount: number,
  targetWpm: number = 145
): WordCountResult {
  const boundedWpm = Math.min(180, Math.max(120, targetWpm || 145));
  const estimatedSeconds = Math.round((wordCount / boundedWpm) * 60);

  const mins = Math.floor(estimatedSeconds / 60);
  const secs = estimatedSeconds % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  // 15-minute target range (13 to 17 minutes)
  const isWithinTarget15Min = estimatedSeconds >= 780 && estimatedSeconds <= 1020;

  let pacingNote = 'Within 15-minute optimal storytelling window';
  if (estimatedSeconds < 780) {
    pacingNote = `Short duration (${mins}m). Target for 15-min episode is ~2,100–2,400 words.`;
  } else if (estimatedSeconds > 1020) {
    pacingNote = `Overlength (${mins}m). Review for narrative padding or split into two-part arc.`;
  }

  return {
    wordCount,
    characterCount: wordCount > 0 ? wordCount * 5 : 0,
    targetWpm: boundedWpm,
    estimatedDurationSeconds: estimatedSeconds,
    estimatedDurationFormatted: formatted,
    isWithinTarget15Min,
    pacingNote,
  };
}

/**
 * Jaccard text similarity token-based comparison to detect duplicate episode concepts,
 * plot beats, or repetitive templates.
 */
export function calculateTextSimilarity(textA: string, textB: string): number {
  if (!textA || !textB) return 0;

  const tokenize = (s: string) => {
    return new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3) // filter short stop words
    );
  };

  const setA = tokenize(textA);
  const setB = tokenize(textB);

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionCount = 0;
  setA.forEach((word) => {
    if (setB.has(word)) intersectionCount++;
  });

  const unionCount = setA.size + setB.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

export interface SimilarityCheckResult {
  isDistinct: boolean;
  maxSimilarityScore: number;
  conflictingEpisodeId?: string;
  warnings: string[];
}

/**
 * Checks a proposed episode's premise, plot, and motifs against prior approved episodes.
 * Flags repetitive storylines, copied dialogue snippets, or overused beats.
 */
export function checkEpisodeDistinctness(
  proposed: {
    workingTitle: string;
    logline: string;
    aPlot: string;
    consequence: string;
    visualMotifs?: string[];
  },
  priorEpisodes: Array<{
    id: string;
    workingTitle: string;
    logline: string;
    aPlot: string;
    consequence: string;
    visualMotifs?: string[];
  }>
): SimilarityCheckResult {
  let maxSimilarity = 0;
  let conflictId: string | undefined;
  const warnings: string[] = [];

  const proposedCombined = `${proposed.workingTitle} ${proposed.logline} ${proposed.aPlot} ${proposed.consequence}`;

  for (const prior of priorEpisodes) {
    const priorCombined = `${prior.workingTitle} ${prior.logline} ${prior.aPlot} ${prior.consequence}`;
    const sim = calculateTextSimilarity(proposedCombined, priorCombined);

    if (sim > maxSimilarity) {
      maxSimilarity = sim;
      conflictId = prior.id;
    }

    if (sim > 0.45) {
      warnings.push(
        `High narrative similarity (${Math.round(sim * 100)}%) with ${prior.id} ("${prior.workingTitle}"). Review for premise or plot beat duplication.`
      );
    }
  }

  // Check motif overuse
  if (proposed.visualMotifs && proposed.visualMotifs.length > 0) {
    const motifCounts = new Map<string, number>();
    for (const prior of priorEpisodes) {
      for (const m of prior.visualMotifs || []) {
        motifCounts.set(m.toLowerCase(), (motifCounts.get(m.toLowerCase()) || 0) + 1);
      }
    }
    for (const m of proposed.visualMotifs) {
      const count = motifCounts.get(m.toLowerCase()) || 0;
      if (count >= 4) {
        warnings.push(`Visual motif "${m}" has been used in ${count} prior episodes. Consider introducing fresh visual emphasis.`);
      }
    }
  }

  return {
    isDistinct: maxSimilarity <= 0.45,
    maxSimilarityScore: maxSimilarity,
    conflictingEpisodeId: conflictId,
    warnings,
  };
}

/**
 * Validates hard fictional continuity rules for Ternfall:
 * - Transmission is via bite/saliva into broken skin, NOT airborne, NOT water-borne
 * - The Still react to mechanical 8-beat pulses, but do not have supernatural powers or speech
 */
export function validateCanonHardRules(scriptText: string): {
  violatesHardRules: boolean;
  infractions: string[];
} {
  const infractions: string[] = [];
  const lower = scriptText.toLowerCase();

  if (lower.includes('airborne') || lower.includes('breathing the air') || lower.includes('spores in the air')) {
    infractions.push('Canon Rule Violation: Infection is not airborne. It spreads only via bite or saliva entering broken skin.');
  }

  if (
    lower.includes('water infected') ||
    lower.includes('infected water') ||
    lower.includes('drinking the water') ||
    lower.includes('poisoned the city water')
  ) {
    infractions.push('Canon Rule Violation: City water does not transmit infection. Rhea’s story explores infrastructure, not magical water contamination.');
  }

  if (lower.includes('zombies talked') || lower.includes('telepathic') || lower.includes('the infected spoke')) {
    infractions.push('Canon Rule Violation: The Still retain motor habits only. They have no speech, telepathy, or deliberate master strategy.');
  }

  return {
    violatesHardRules: infractions.length > 0,
    infractions,
  };
}
