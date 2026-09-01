function nodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; text?: string; content?: unknown[]; attrs?: Record<string, unknown> };
  if (typeof n.text === "string") return n.text;
  if (n.type === "text") return "";
  if (n.type === "image") return n.attrs?.alt ? `[Image: ${String(n.attrs.alt)}]` : "[Image]";
  if (Array.isArray(n.content)) return n.content.map(nodeText).join(" ");
  return "";
}

export function richTextToPlain(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" ? nodeText(parsed) : parsed;
    } catch {
      return value;
    }
  }
  return typeof value === "object" ? nodeText(value) : String(value);
}

export type QuestionChoice =
  | { type: "mcq"; options: { content: unknown; is_correct: boolean }[] }
  | { type: "multi"; options: { content: unknown; is_correct: boolean }[] }
  | { type: "true_false"; options: { content: unknown; is_correct: boolean }[] }
  | { type: "match"; options: { content: unknown; is_correct: boolean }[] }
  | { type: "fill_blank"; options: { content: unknown; is_correct: boolean }[] }
  | { type: "essay" | "short" | "long" | "number" | "sq" | "other"; options: { content: unknown; is_correct: boolean }[] };
