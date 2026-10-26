/** 下拉框（components/ui/Select）的纯逻辑：键盘导航、首字母跳转、搜索过滤、弹层定位。零 DOM 依赖。 */

export type SelectOption = {
  value: string;
  /** 显示文字；也用于首字母跳转和搜索 */
  label: string;
  /** 右侧的弱化补充说明，如数量、状态 */
  hint?: string;
  disabled?: boolean;
};

type Navigable = Pick<SelectOption, "disabled">;

/** 从 from 开始沿 dir 方向找下一个可选项（不含 from 本身），到头不回绕；找不到返回 from。 */
export function stepEnabled(options: readonly Navigable[], from: number, dir: 1 | -1, count = 1): number {
  let found = from;
  let left = count;
  for (let i = from + dir; i >= 0 && i < options.length && left > 0; i += dir) {
    if (!options[i].disabled) {
      found = i;
      left--;
    }
  }
  return found;
}

export function firstEnabled(options: readonly Navigable[]): number {
  return options.findIndex((o) => !o.disabled);
}

export function lastEnabled(options: readonly Navigable[]): number {
  for (let i = options.length - 1; i >= 0; i--) if (!options[i].disabled) return i;
  return -1;
}

/** 打开时的初始高亮：已选中且可选的项，否则第一个可选项；全部禁用时返回 -1。 */
export function initialActive(options: readonly SelectOption[], value: string | undefined): number {
  const i = options.findIndex((o) => o.value === value);
  return i >= 0 && !options[i].disabled ? i : firstEnabled(options);
}

const norm = (s: string) => s.trim().toLocaleLowerCase();

/**
 * 首字母跳转：从 from 的下一项起循环查找 label 以 query 开头的可选项。
 * query 由同一个字符重复组成时（如 "aaa"）按单字符处理，便于连续按同一键在同首字母项之间轮换。
 */
export function typeahead(options: readonly SelectOption[], query: string, from: number): number {
  let q = norm(query);
  if (!q) return -1;
  if ([...q].every((ch) => ch === q[0])) q = q[0];
  const n = options.length;
  // 多字符查询时当前项本身也算（边打字边细化），单字符时从下一项开始轮换
  const start = q.length > 1 ? 0 : 1;
  for (let k = start; k <= n; k++) {
    const i = (((from + k) % n) + n) % n;
    const o = options[i];
    if (!o.disabled && norm(o.label).startsWith(q)) return i;
  }
  return -1;
}

/** 搜索过滤：label / hint / value 包含关键词（忽略大小写和首尾空白）。返回原数组中的下标，保证选项 id 稳定。 */
export function filterOptions(options: readonly SelectOption[], query: string): number[] {
  const q = norm(query);
  const out: number[] = [];
  options.forEach((o, i) => {
    if (!q || norm(o.label).includes(q) || (o.hint && norm(o.hint).includes(q)) || norm(o.value).includes(q)) out.push(i);
  });
  return out;
}

export type Placement = {
  side: "bottom" | "top";
  /** side=bottom 时为弹层 top，side=top 时为弹层 bottom（均为相对视口的 px） */
  offset: number;
  left: number;
  maxHeight: number;
};

/**
 * 弹层定位（position: fixed）。默认放在触发器下方；下方放不下内容且上方空间更大时翻到上方。
 * 水平方向左对齐触发器，超出视口右侧时向左收回，始终保留 margin 边距。
 */
export function placePopover(input: {
  trigger: { top: number; bottom: number; left: number };
  viewport: { width: number; height: number };
  /** 弹层内容不受限时的自然高度 */
  contentHeight: number;
  popoverWidth: number;
  gap?: number;
  margin?: number;
  maxHeight?: number;
}): Placement {
  const { trigger, viewport, contentHeight, popoverWidth, gap = 6, margin = 8, maxHeight = 320 } = input;
  const below = viewport.height - trigger.bottom - gap - margin;
  const above = trigger.top - gap - margin;
  const side = below >= Math.min(contentHeight, maxHeight) || below >= above ? "bottom" : "top";
  const space = Math.max(0, side === "bottom" ? below : above);
  const left = Math.max(margin, Math.min(trigger.left, viewport.width - popoverWidth - margin));
  return {
    side,
    offset: side === "bottom" ? trigger.bottom + gap : viewport.height - trigger.top + gap,
    left,
    maxHeight: Math.min(maxHeight, space),
  };
}
