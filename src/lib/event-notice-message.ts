/** Template parameters cannot contain newlines; preserve all words, never truncate. */
export function splitNotice(message: string, limit = 850): string[] {
  const words = message.trim().split(/\s+/u);
  const parts: string[] = [];
  let current = "";
  for (const word of words) {
    if (word.length > limit) throw new Error("Palavra excede o limite do modelo.");
    if (current && `${current} ${word}`.length > limit) {
      parts.push(current);
      current = word;
    } else current = current ? `${current} ${word}` : word;
  }
  if (current) parts.push(current);
  return parts.map((part, i) => parts.length > 1 ? `(${i + 1}/${parts.length}) ${part}` : part);
}
