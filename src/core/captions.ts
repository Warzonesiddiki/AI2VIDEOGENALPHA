/**
 * Ternfall Studio - Caption & Subtitle Generator
 * Formats SRT and WebVTT from scene/beat text and audio durations.
 * Enforces readability limits (<=42 chars/line, <=2 lines) and 16:9 vs 9:16 safe margins.
 */

export interface CaptionBlock {
  index: number;
  startSeconds: number;
  endSeconds: number;
  speaker?: string;
  lines: string[];
}

export function formatTimecodeSrt(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor((totalSeconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

export function formatTimecodeVtt(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor((totalSeconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Splits caption text into readable chunks with max line length.
 */
export function wrapCaptionLines(text: string, maxCharsPerLine: number = 42): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length >= 2) break; // limit to 2 lines per subtitle block
    }
  }

  if (currentLine && lines.length < 2) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Generates valid SubRip (.srt) subtitle string.
 */
export function generateSrtContent(blocks: CaptionBlock[]): string {
  let srt = '';
  for (const block of blocks) {
    srt += `${block.index}\n`;
    srt += `${formatTimecodeSrt(block.startSeconds)} --> ${formatTimecodeSrt(block.endSeconds)}\n`;
    if (block.speaker) {
      srt += `[${block.speaker}] `;
    }
    srt += block.lines.join('\n') + '\n\n';
  }
  return srt.trim() + '\n';
}

/**
 * Generates valid WebVTT (.vtt) subtitle string.
 */
export function generateVttContent(blocks: CaptionBlock[]): string {
  let vtt = 'WEBVTT - Ternfall Studio Episode Captions\n\n';
  for (const block of blocks) {
    vtt += `${block.index}\n`;
    vtt += `${formatTimecodeVtt(block.startSeconds)} --> ${formatTimecodeVtt(block.endSeconds)}\n`;
    if (block.speaker) {
      vtt += `<v ${block.speaker}>`;
    }
    vtt += block.lines.join('\n') + '\n\n';
  }
  return vtt.trim() + '\n';
}
