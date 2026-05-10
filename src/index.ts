export {
  detect,
  createDetector,
  type DetectionResult,
  type Match,
  type Severity,
  type WordEntry,
} from "./detector/index";
export { detectEmojis, classifyEmoji, type EmojiMatch } from "./detector/emoji";
export { createAdapter, allAdapters, type Adapter, type Message } from "./adapters/index";
