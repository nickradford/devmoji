/**
 * Fetches emoji-test.txt from Unicode.org and generates a compact
 * TypeScript source file mapping base emoji → Unicode group.
 *
 * Skin tones (U+1F3FB–U+1F3FF) and variation selectors (U+FE0F)
 * are stripped from keys — the runtime classifier strips them
 * before lookup, reducing the map from ~5200 to ~1900 entries.
 *
 * Run: npx tsx scripts/generate-emoji-groups.ts
 *       or: bun run scripts/generate-emoji-groups.ts
 * Output: src/detector/emoji-groups.g.ts (gitignored)
 */
import { writeFileSync } from "node:fs";

const EMOJI_TEST_URL = "https://unicode.org/Public/emoji/latest/emoji-test.txt";
const OUTPUT = new URL("../src/detector/emoji-groups.g.ts", import.meta.url)
  .pathname;

async function main() {
  console.error(`Fetching ${EMOJI_TEST_URL}...`);
  const res = await fetch(EMOJI_TEST_URL);
  const text = await res.text();

  // Build base-emoji → group map (strip skin tones and FE0F from keys)
  const map: Record<string, string> = {};
  let currentGroup = "";

  for (const line of text.split("\n")) {
    const gm = line.match(/^# group:\s*(.+)/);
    if (gm) {
      currentGroup = gm[1]!.trim();
      continue;
    }

    if (!line.trim() || line.startsWith("#")) continue;
    if (currentGroup === "Component") continue;

    const m = line.match(
      /^([0-9A-Fa-f ]+?)\s*;\s*(\S+)\s*#\s*(\S+)/,
    );
    if (!m) continue;

    const status = m[2]!;
    const emoji = m[3]!;

    // Normalize: strip skin tones and FE0F variation selector
    const base = emoji
      .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "")
      .replace(/\uFE0F/g, "");

    // Prefer fully-qualified entries
    if (map[base] && status !== "fully-qualified") continue;

    map[base] = currentGroup;
  }

  console.error(`Parsed ${Object.keys(map).length} base-emoji → group mappings`);

  // Show distribution
  const dist: Record<string, number> = {};
  for (const g of Object.values(map)) dist[g] = (dist[g] ?? 0) + 1;
  for (const [g, c] of Object.entries(dist).sort(([, a], [, b]) => b - a)) {
    console.error(`  ${g}: ${c}`);
  }

  // Generate compact TypeScript: a single object literal
  // Using JSON.stringify on the object is both compact and valid TS
  const ts =
    `// Auto-generated from ${EMOJI_TEST_URL}\n` +
    `// Do not edit. Regenerate with: bun run scripts/generate-emoji-groups.ts\n` +
    `// ${Object.keys(map).length} entries, skin tones stripped (classifier strips them before lookup)\n` +
    `const emojiGroups: Record<string, string> = ${JSON.stringify(map, null, 0)};\n` +
    `export default emojiGroups;\n`;

  writeFileSync(OUTPUT, ts, "utf-8");
  console.error(`Written to ${OUTPUT} (${ts.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
