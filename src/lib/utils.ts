import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 停用词：自动提取标签时过滤无明显意义的词
const STOP_WORDS = new Set([
  '的', '了', '和', '与', '是', '在', '我', '你', '他', '她', '它',
  '我们', '你们', '他们', '这个', '那个', '一个', '一些', '如何', '怎么',
  '什么', '可以', '需要', '请', '帮', '让', '用', '对', '为', '从', '到',
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with',
  'is', 'are', 'was', 'were', 'be', 'how', 'what', 'why', 'please',
]);

/**
 * 从提示词中自动提取标签（英文单词 + 中文词组，去重去停用词）
 * 无有效内容时返回空数组
 */
export function extractTagsFromPrompt(prompt: string, maxTags = 4): string[] {
  const text = prompt.trim();
  if (!text) return [];

  // 中英文统一分词：英文按单词，中文按 2-4 字连续片段
  const tokens: string[] = [];

  // 英文单词（含数字）
  const en = text.match(/[a-zA-Z][a-zA-Z0-9_]{1,19}/g) || [];
  for (const w of en) {
    const lower = w.toLowerCase();
    if (!STOP_WORDS.has(lower)) tokens.push(lower);
  }

  // 中文片段（连续中文，切成 2-3 字滑动窗口）
  const zh = text.match(/[\u4e00-\u9fa5]{2,}/g) || [];
  for (const seg of zh) {
    for (let i = 0; i < seg.length - 1; i++) {
      const token = seg.slice(i, i + 2);
      if (!STOP_WORDS.has(token)) tokens.push(token);
    }
  }

  // 去重、去停用词、限长
  const result: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(t);
    if (result.length >= maxTags) break;
  }

  return result;
}
