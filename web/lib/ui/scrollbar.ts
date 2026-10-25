/**
 * 自定义滚动条的纯计算（零 DOM 依赖，单轴通用：纵向用 height/scrollTop，横向用 width/scrollLeft）。
 *
 * 术语：
 * - viewport：可视区尺寸（clientHeight / clientWidth）
 * - content：内容总尺寸（scrollHeight / scrollWidth）
 * - track：轨道可用长度（拇指能活动的总长度）
 * - scroll：当前滚动位置（scrollTop / scrollLeft）
 */

export type Axis = { viewport: number; content: number; track: number };

export type ThumbMetrics = {
  /** 内容是否溢出（溢出才显示滚动条） */
  visible: boolean;
  /** 拇指长度（px） */
  size: number;
  /** 拇指相对轨道起点的偏移（px） */
  offset: number;
};

/** 拇指最短长度，保证内容极长时仍易于抓取 */
export const MIN_THUMB = 28;

/** 子像素误差容忍：缩放 / 小数像素下 scrollHeight 可能比 clientHeight 多出 1px */
const EPSILON = 1;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const finite = (v: number) => (Number.isFinite(v) ? v : 0);

/** 最大可滚动距离 */
export function maxScroll({ viewport, content }: Pick<Axis, "viewport" | "content">): number {
  return Math.max(0, finite(content) - finite(viewport));
}

/** 内容是否溢出 */
export function isOverflowing(a: Pick<Axis, "viewport" | "content">): boolean {
  return maxScroll(a) > EPSILON;
}

/** 拇指长度：按可视比例缩放，不短于 minThumb，不长于轨道 */
export function thumbSize(a: Axis, minThumb = MIN_THUMB): number {
  const track = Math.max(0, finite(a.track));
  const content = finite(a.content);
  if (track === 0 || content <= 0) return 0;
  const ratio = clamp(finite(a.viewport) / content, 0, 1);
  return clamp(Math.round(track * ratio), Math.min(minThumb, track), track);
}

/** 拇指尺寸 + 位置 */
export function thumbMetrics(a: Axis & { scroll: number }, minThumb = MIN_THUMB): ThumbMetrics {
  const visible = isOverflowing(a) && a.track > 0;
  if (!visible) return { visible: false, size: 0, offset: 0 };
  const size = thumbSize(a, minThumb);
  const room = Math.max(0, a.track - size);
  const max = maxScroll(a);
  const progress = max > 0 ? clamp(finite(a.scroll) / max, 0, 1) : 0;
  return { visible, size, offset: Math.round(room * progress * 100) / 100 };
}

/**
 * 点击轨道（拇指以外区域）后的目标滚动位置：朝点击方向翻一页。
 * 一页 = 可视区长度减去少量重叠，保留上下文；结果夹在 [0, maxScroll]。
 * 点在拇指上返回当前位置不变。
 */
export function trackClickScroll(
  a: Axis & { scroll: number },
  clickPos: number,
  thumb: Pick<ThumbMetrics, "size" | "offset">,
  overlap = 0.1,
): number {
  const max = maxScroll(a);
  const page = Math.max(1, a.viewport * (1 - clamp(overlap, 0, 0.9)));
  const cur = clamp(finite(a.scroll), 0, max);
  if (clickPos < thumb.offset) return clamp(cur - page, 0, max);
  if (clickPos > thumb.offset + thumb.size) return clamp(cur + page, 0, max);
  return cur;
}

/**
 * 拖动拇指：指针移动 delta 像素 → 新的滚动位置。
 * 拇指可活动距离（track - size）映射到全部可滚动距离（content - viewport）。
 */
export function dragToScroll(a: Axis, startScroll: number, delta: number, size: number): number {
  const max = maxScroll(a);
  const room = a.track - size;
  if (room <= 0 || max <= 0) return clamp(finite(startScroll), 0, max);
  return clamp(finite(startScroll) + finite(delta) * (max / room), 0, max);
}
