/** 拖拽重排的纯逻辑（零 DOM 依赖），供首页精选等后台列表复用。 */

/** 返回把 from 位置的元素移到 to 位置后的新数组；越界或不变时返回原数组副本。 */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return next;
  const [picked] = next.splice(from, 1);
  next.splice(to, 0, picked);
  return next;
}

/** 按 id 移动：activeId 移到 overId 当前所在位置；任一 id 不存在时原样返回。 */
export function moveById<T extends { id: string }>(list: readonly T[], activeId: string, overId: string | null | undefined): T[] {
  if (!overId) return [...list];
  const from = list.findIndex((x) => x.id === activeId);
  const to = list.findIndex((x) => x.id === overId);
  if (from < 0 || to < 0) return [...list];
  return moveItem(list, from, to);
}

/** 拖动过程中的预览顺序：用于实时刷新序号徽章。 */
export function previewOrder<T extends { id: string }>(list: readonly T[], activeId: string | null, overId: string | null): T[] {
  if (!activeId) return [...list];
  return moveById(list, activeId, overId);
}

/** 两个顺序是否一致（按 id）。 */
export function sameOrder(a: readonly { id: string }[], b: readonly { id: string }[]): boolean {
  return a.length === b.length && a.every((x, i) => x.id === b[i].id);
}

/** 生成提交给 saveFeaturedAction 的 ids（去重、去空，保持顺序）。 */
export function featuredIds(list: readonly { id: string }[]): string[] {
  return [...new Set(list.map((x) => x.id).filter(Boolean))];
}

/** 生成 FormData 载荷：与原表单一致，多个 name="ids"。 */
export function toFeaturedFormData(list: readonly { id: string }[]): FormData {
  const fd = new FormData();
  for (const id of featuredIds(list)) fd.append("ids", id);
  return fd;
}
