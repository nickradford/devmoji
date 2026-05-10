import emojiGroups from "./emoji-groups.g";

export interface EmojiMatch {
  emoji: string;
  index: number;
  /** Unicode group name (e.g. "Smileys & Emotion", "Flags") */
  group: string;
}

/**
 * Skin tone modifier codepoints (U+1F3FB – U+1F3FF).
 */
const SKIN_TONES_RE = /[\u{1F3FB}-\u{1F3FF}]/gu;

/**
 * Variation selector U+FE0F.
 */
const FE0F_RE = /\uFE0F/g;

/**
 * Classify an emoji into its Unicode group using the build-time
 * generated lookup table. Strips skin tones and variation selectors
 * before lookup.
 */
export function classifyEmoji(emoji: string): string {
  // 1. Normalize: strip skin tones and FE0F
  const base = emoji.replace(SKIN_TONES_RE, "").replace(FE0F_RE, "");

  // 2. Exact lookup
  const group = emojiGroups[base];
  if (group) return group;

  // 3. Fallback heuristics
  // Regional indicator pairs → Flags
  if (/^\p{RI}\p{RI}$/u.test(emoji)) return "Flags";

  // Keycaps → Symbols
  if (/\u20E3$/.test(emoji)) return "Symbols";

  return "Other";
}

/**
 * Unicode-aware emoji regex. Matches:
 *   - Flags: regional indicator pairs (🇺🇸)
 *   - Basic emojis (😀, ❤️, 👍)
 *   - Skin tones (👍🏻, 👋🏿)
 *   - ZWJ sequences (👨‍👩‍👧‍👦, 🤦🏻‍♀️)
 *   - Keycaps (#️⃣, 1️⃣ - 9️⃣)
 */
const EMOJI_RE = new RegExp(
  [
    // Regional indicator pairs — exactly two consecutive RIs form a flag
    "\\p{RI}\\p{RI}",
    // Emoji base + optional modifier/skin-tone + optional ZWJ chains
    "[\\p{Emoji_Presentation}\\p{Extended_Pictographic}]" +
      "(?:[\\u{1F3FB}-\\u{1F3FF}]|\\u{FE0F})?" +
      "(?:\\u{200D}[\\p{Emoji_Presentation}\\p{Extended_Pictographic}](?:[\\u{1F3FB}-\\u{1F3FF}]|\\u{FE0F})?)*",
    // Keycap sequences
    "[#*0-9]\\u{FE0F}?\\u{20E3}",
  ].join("|"),
  "gu",
);

export function detectEmojis(text: string): EmojiMatch[] {
  const matches: EmojiMatch[] = [];
  EMOJI_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = EMOJI_RE.exec(text)) !== null) {
    matches.push({
      emoji: match[0],
      index: match.index,
      group: classifyEmoji(match[0]),
    });
  }

  return matches;
}
