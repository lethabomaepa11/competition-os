export const commentaryStyles = ["professional", "energetic", "tactical", "playful"] as const;
export type CommentaryStyle = typeof commentaryStyles[number];

export const commentaryStyleLabels: Record<CommentaryStyle, string> = {
  professional: "Professional broadcast",
  energetic: "High energy",
  tactical: "Tactical analyst",
  playful: "Playful",
};

export function isCommentaryStyle(value: unknown): value is CommentaryStyle {
  return typeof value === "string" && commentaryStyles.includes(value as CommentaryStyle);
}

export function commentaryStyleDirection(style: CommentaryStyle): string {
  if (style === "energetic") return "Use active, urgent broadcast language without inventing crowd or match actions.";
  if (style === "tactical") return "Focus on the score margin and competitive situation in calm analyst language.";
  if (style === "playful") return "Use one restrained, good-natured sporting joke without mocking an entrant.";
  return "Use concise, neutral professional broadcast language.";
}

export function groundedScoreSummary(nameById: Map<string, string>, scores: { participantId: string; value: number }[], style: CommentaryStyle): string {
  const ordered = scores.slice(0, 2);
  if (ordered.length < 2) return "The latest score has been recorded. The contest is still unfolding.";
  const a = ordered[0].value;
  const b = ordered[1].value;
  const left = nameById.get(ordered[0].participantId) ?? "Entrant one";
  const right = nameById.get(ordered[1].participantId) ?? "Entrant two";
  if (a === b) return style === "playful" ? `All square at ${a}–${b}; the scoreboard has chosen diplomacy.` : `All square at ${a}–${b}. Neither side has created daylight yet.`;
  const leader = a > b ? left : right;
  const margin = Math.abs(a - b);
  if (style === "energetic") return `${leader} drives into a ${margin}-point lead at ${a}–${b}. The response has to come now.`;
  if (style === "tactical") return `${leader} holds a ${margin}-point advantage at ${a}–${b}; the trailing side needs to close the margin without giving away another score.`;
  if (style === "playful") return `${leader} leads ${a}–${b}; the scoreboard is beginning to pick a favourite, but it has been wrong before.`;
  return margin >= 5
    ? `${leader} has opened a ${margin}-point gap (${a}–${b}). There is still time for a response.`
    : `${leader} leads ${a}–${b}. This remains finely balanced.`;
}
