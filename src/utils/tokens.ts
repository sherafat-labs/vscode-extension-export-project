/**
 * Estimates token count for a text string using character heuristic (~4 characters per token).
 */
export function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.ceil(text.length / 4);
}
