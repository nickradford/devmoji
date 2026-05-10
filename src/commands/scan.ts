import { allAdapters, createAdapter } from "../adapters/index";
import { detect } from "../detector/index";
import { detectEmojis } from "../detector/emoji";

// ANSI color helpers — no dependencies needed
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

const SPINNER_MESSAGES = [
  "Tallying the damage",
  "Reviewing your outbursts",
  "Judging your vocabulary",
  "Computing your shame",
  "Cataloging the profanity",
  "Measuring your frustration",
  "Assessing the verbal carnage",
  "Quantifying your displeasure",
  "Auditing your language",
  "Tabulating regrets",
];

function createSpinner() {
  let messageIdx = 0;
  let dotCount = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    start() {
      messageIdx = Math.floor(Math.random() * SPINNER_MESSAGES.length);
      timer = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        const msg = SPINNER_MESSAGES[messageIdx % SPINNER_MESSAGES.length];
        const dots = ".".repeat(dotCount || 1);
        process.stdout.write(
          `\r  ${c.dim}${msg}${dots}${c.reset}   `,
        );
      }, 300);
    },
    update() {
      messageIdx++;
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      process.stdout.write("\r" + " ".repeat(60) + "\r");
    },
  };
}

// ─── arg parsing ──────────────────────────────────────────────────────

interface ScanOptions {
  agent?: string;
  since?: Date;
  emoji: boolean;
}

function parseArgs(args: string[]): ScanOptions {
  const options: ScanOptions = { emoji: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--agent" || arg === "-a") {
      options.agent = args[++i];
    } else if (arg === "--since" || arg === "-s") {
      const val = args[++i];
      if (val) {
        options.since = new Date(val);
        if (isNaN(options.since.getTime())) {
          console.error(`invalid date: ${val}`);
          process.exit(1);
        }
      }
    } else if (arg === "--emoji") {
      options.emoji = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`devrage scan — scan sessions for profanity or emojis

Options:
  --emoji              Scan for emojis instead of profanity
  --agent, -a <name>   Scan only a specific agent (claude, codex, opencode, amp, cline, zed)
  --since, -s <date>   Only scan messages after this date (ISO 8601)
  --help, -h           Show this help`);
      process.exit(0);
    }
  }

  return options;
}

// ─── per-agent stats ──────────────────────────────────────────────────

interface AgentStats {
  messages: number;
  items: number;
}

// ─── helpers ──────────────────────────────────────────────────────────

/** Print a section header */
function header(title: string, color: string = c.blue): void {
  console.log(`  ${c.bold}${color}${title}${c.reset}`);
}

/** Print a subtle label */
function label(text: string): string {
  return `${c.dim}${text}${c.reset}`;
}

// ─── main scan command ────────────────────────────────────────────────

export async function scan(args: string[]): Promise<void> {
  const options = parseArgs(args);

  const adapters = options.agent
    ? [createAdapter(options.agent)]
    : allAdapters();

  const spinner = createSpinner();
  spinner.start();

  // ── shared message iteration ────────────────────────────────
  let totalMessages = 0;
  const perAgent: Record<string, AgentStats> = {};

  if (options.emoji) {
    // ═══════════════════════════════════════════════════════════
    //  EMOJI MODE
    // ═══════════════════════════════════════════════════════════
    const groupTally: Record<string, number> = {};
    const emojiTally: Record<string, Record<string, number>> = {};
    let totalEmojis = 0;

    for (const adapter of adapters) {
      let agentMessages = 0;
      let agentEmojis = 0;
      spinner.update();

      for await (const message of adapter.messages({ since: options.since })) {
        totalMessages++;
        agentMessages++;

        const matches = detectEmojis(message.text);
        if (matches.length > 0) {
          totalEmojis += matches.length;
          agentEmojis += matches.length;

          for (const m of matches) {
            groupTally[m.group] = (groupTally[m.group] ?? 0) + 1;

            const variants = (emojiTally[m.group] ??= {});
            variants[m.emoji] = (variants[m.emoji] ?? 0) + 1;
          }
        }
      }

      if (agentMessages > 0) {
        perAgent[adapter.name] = { messages: agentMessages, items: agentEmojis };
      }
    }

    spinner.stop();

    // ── emoji report ─────────────────────────────────────────
    console.log("");
    console.log(`  ${c.bold}${c.blue}devrage${c.reset} ${c.dim}report ${c.reset}${c.dim}(emoji mode)${c.reset}`);
    console.log(`  ${c.dim}${"─".repeat(30)}${c.reset}`);
    console.log("");
    console.log(`  ${label("messages scanned")}  ${c.bold}${totalMessages}${c.reset}`);
    console.log(`  ${label("total emojis")}       ${c.bold}${c.blue}${totalEmojis}${c.reset}`);

    const agents = Object.entries(perAgent);
    if (agents.length > 1) {
      console.log("");
      header("by agent", c.dim);
      for (const [name, stats] of agents) {
        const rate = ((stats.items / stats.messages) * 100).toFixed(1);
        console.log(
          `    ${c.cyan}${name.padEnd(10)}${c.reset} ${c.bold}${String(stats.items).padStart(4)}${c.reset} ${c.dim}in ${stats.messages} messages (${rate}%)${c.reset}`,
        );
      }
    }

    if (totalEmojis > 0) {
      // Sort groups by count descending
      const sortedGroups = Object.entries(groupTally).sort(
        ([, a], [, b]) => b - a,
      );
      console.log("");
      header("by category", c.blue);

      for (const [group, count] of sortedGroups) {
        const pct = ((count / totalEmojis) * 100).toFixed(1);
        console.log(
          `  ${c.bold}${c.magenta}${group}${c.reset}  ${c.bold}${count}${c.reset} ${c.dim}(${pct}%)${c.reset}`,
        );

        // Show top emojis within this group
        const variants = emojiTally[group] ?? {};
        const sorted = Object.entries(variants)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 8);

        for (const [emoji, cnt] of sorted) {
          console.log(
            `    ${emoji} ${c.bold}${String(cnt).padStart(3)}${c.reset}`,
          );
        }
      }
    }

    console.log("");
    if (totalEmojis === 0) {
      console.log(`  ${c.green}no emojis found. all business, no fun.${c.reset}`);
      console.log("");
    }
  } else {
    // ═══════════════════════════════════════════════════════════
    //  PROFANITY MODE (default)
    // ═══════════════════════════════════════════════════════════
    const groupTally: Record<string, number> = {};
    const variantTally: Record<string, Record<string, number>> = {};
    let totalSwears = 0;

    for (const adapter of adapters) {
      let agentMessages = 0;
      let agentSwears = 0;
      spinner.update();

      for await (const message of adapter.messages({ since: options.since })) {
        totalMessages++;
        agentMessages++;

        const result = detect(message.text);
        if (result.count > 0) {
          totalSwears += result.count;
          agentSwears += result.count;

          for (const match of result.matches) {
            groupTally[match.group] = (groupTally[match.group] ?? 0) + 1;

            const variants = (variantTally[match.group] ??= {});
            variants[match.word] = (variants[match.word] ?? 0) + 1;
          }
        }
      }

      if (agentMessages > 0) {
        perAgent[adapter.name] = { messages: agentMessages, items: agentSwears };
      }
    }

    spinner.stop();

    // ── profanity report ─────────────────────────────────────
    console.log("");
    console.log(`  ${c.bold}${c.red}devrage${c.reset} ${c.dim}report${c.reset}`);
    console.log(`  ${c.dim}${"─".repeat(30)}${c.reset}`);
    console.log("");
    console.log(`  ${c.dim}messages scanned${c.reset}  ${c.bold}${totalMessages}${c.reset}`);
    console.log(`  ${c.dim}total swears${c.reset}      ${c.bold}${c.red}${totalSwears}${c.reset}`);

    const agents = Object.entries(perAgent);
    if (agents.length > 1) {
      console.log("");
      header("by agent", c.dim);
      for (const [name, stats] of agents) {
        const rate = ((stats.items / stats.messages) * 100).toFixed(1);
        console.log(
          `    ${c.cyan}${name.padEnd(10)}${c.reset} ${c.bold}${String(stats.items).padStart(4)}${c.reset} ${c.dim}in ${stats.messages} messages (${rate}%)${c.reset}`,
        );
      }
    }

    if (totalSwears > 0) {
      const sorted = Object.entries(groupTally).sort(([, a], [, b]) => b - a);
      console.log("");
      header("top words", c.red);
      for (const [group, count] of sorted.slice(0, 10)) {
        const variants = variantTally[group] ?? {};
        const variantList = Object.entries(variants)
          .sort(([, a], [, b]) => b - a)
          .filter(([v]) => v !== group)
          .slice(0, 15)
          .map(([v, cnt]) => `${c.dim}${v}${c.reset} ${cnt}`)
          .join(`${c.dim},${c.reset} `);
        const suffix = variantList ? ` ${c.dim}(${c.reset}${variantList}${c.dim})${c.reset}` : "";
        console.log(
          `    ${c.yellow}${group.padEnd(12)}${c.reset} ${c.bold}${String(count).padStart(4)}${c.reset}${suffix}`,
        );
      }
    }

    console.log("");
    if (totalSwears === 0) {
      console.log(`  ${c.green}squeaky clean! not a single swear found.${c.reset}`);
      console.log("");
    }
  }
}
