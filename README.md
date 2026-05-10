# devrage

Count how many times you swear at your coding agents.

devrage scans your local agent session history — Claude Code, Codex, OpenCode, Amp, Cline, Zed — and tallies every swear word you've typed at them. It reads session files directly from disk. Nothing leaves your machine.

```
$ devrage

  devrage report
  ──────────────────────────────

  messages scanned  1,247
  total swears      89

  top words
    fuck              42  (fucking 18, fucked 7, fuk 5, fcuk 3)
    shit              21  (bullshit 8, shitty 4)
    damn               9  (dammit 5, goddammit 2)
    bitch              6  (bitching 3)
    wtf                5
    hell               3
    crap               2
    piss               1
```

## Install

```bash
npm install -g devrage
```

Requires Node.js ≥ 20.

## Usage

```bash
devrage                    # scan everything
devrage scan               # same as above
devrage --help             # show help
devrage --version          # show version
```

**Filter by agent:**

```bash
devrage scan --agent claude
devrage scan --agent codex
devrage scan --agent opencode
devrage scan -a zed
```

**Filter by date:**

```bash
devrage scan --since 2025-01-01
devrage scan --since 2025-06-01 --agent claude
```

## Supported agents

| Agent | Data source |
|-------|-------------|
| Claude Code | `~/.claude/projects/*/<session>.jsonl` |
| Codex (OpenAI) | `~/.codex/sessions/**/<session>.jsonl` |
| OpenCode | `~/.local/share/opencode/opencode.db` (SQLite) |
| Amp (Sourcegraph) | `~/.local/share/amp/threads/<id>.json` |
| Cline / Roo Code | VS Code globalStorage / `~/.cline/data/tasks/` |
| Zed | `~/Library/Application Support/Zed/conversations/` + db |

## Library usage

devrage exports its detector and adapters for use in your own tools.

```ts
import { detect, createDetector, createAdapter, allAdapters } from "devrage";

// Detect profanity in any string
const result = detect("what the fuck is this bullshit");
// result.count → 2
// result.matches → [{ word: "fuck", severity: "strong", group: "fuck" }, ...]

// Create a custom detector with your own wordlist
const myDetect = createDetector([
  { word: "borked", severity: "mild", group: "borked" },
]);
myDetect("this is completely borked");

// Read messages from agent sessions
const adapter = createAdapter("claude");
for await (const msg of adapter.messages({ since: new Date("2025-01-01") })) {
  console.log(msg.text, msg.session);
}
```

## Wordlist

The detector covers ~80 words across 11 groups, with severity ratings:

- **Strong:** fuck, shit, bitch, bastard, cunt, asshole (and compounds/typos)
- **Moderate:** damn, ass, piss, dick, crap (and compounds/typos)
- **Mild:** hell, wtf, stfu, lmao (and variants)

Typo variants are included (e.g. `fcuk`, `fukc`, `siht`, `bulshit`). Repeated characters are normalized (e.g. `fuuuuck` → `fuck`).

## Build

```bash
npm run build       # esbuild for CLI + tsc for library types
npm run dev         # watch mode
npm run typecheck   # tsc --noEmit
npm run lint        # oxlint
npm run format      # oxfmt
```

## License

MIT
