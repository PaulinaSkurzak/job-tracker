import type { Schemas } from "@/lib/api/client";

export type Segment = { text: string; kind: "plain" | "have" | "missing"; skill?: string };

/**
 * Split a job description into plain and highlighted pieces using the API's spans (start/end indexes
 * into the text). The server decides where skills are, so these highlights always agree with the score.
 * Spans that don't fit the text (it changed since the request was sent) are skipped rather than mis-drawn.
 */
export function segments(text: string, spans: Schemas["SkillSpan"][], have: Set<string>): Segment[] {
  const result: Segment[] = [];
  let cursor = 0;
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    if (span.start < cursor || span.end > text.length || span.end <= span.start) continue;
    if (span.start > cursor) result.push({ text: text.slice(cursor, span.start), kind: "plain" });
    result.push({ text: text.slice(span.start, span.end), kind: have.has(span.skill) ? "have" : "missing", skill: span.skill });
    cursor = span.end;
  }
  if (cursor < text.length) result.push({ text: text.slice(cursor), kind: "plain" });
  return result;
}
