"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Modifier,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type TouchEvent } from "react";
import { Button, ScrollArea } from "@/components/ui";
import { useToast } from "@/components/tool/shared";
import type { ActionResult } from "@/lib/domain/result";
import { moveById, previewOrder, toFeaturedFormData } from "@/lib/ui/reorder";
import styles from "./admin.module.css";

type Item = { id: string; name: string; note?: string };

type Props = {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  initial: Item[];
  candidates: Item[];
  max: number;
};

/** 只允许纵向移动 */
const lockX: Modifier = ({ transform }) => ({ ...transform, x: 0 });

const keyOf = (xs: Item[]) => xs.map((x) => `${x.id}:${x.note ?? ""}`).join("|");

/**
 * 精选排序：整行拖拽（鼠标 / 触屏长按 / 键盘手柄），松手即自动保存；
 * 加入、移除同样即时保存。失败回滚到最近一次保存成功的顺序。
 */
export function FeaturedEditor({ action, initial, candidates, max }: Props) {
  const dndId = useId();
  const [items, setItems] = useState(initial);
  const [pick, setPick] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const { show, node: toast } = useToast();

  // 最近一次服务端确认的顺序（回滚目标）
  const committed = useRef(initial);
  const seq = useRef(0);

  // 服务端数据变化（保存后 updateTag 刷新、或他处修改）时同步，拖动/保存中不打断
  const initialKey = keyOf(initial);
  const [syncedKey, setSyncedKey] = useState(initialKey);
  if (initialKey !== syncedKey && !saving && !activeId) {
    setSyncedKey(initialKey);
    setItems(initial);
  }
  useEffect(() => {
    committed.current = initial;
  }, [initialKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const pool = candidates.filter((c) => !items.some((i) => i.id === c.id));
  const preview = previewOrder(items, activeId, overId);
  const numberOf = (id: string) => preview.findIndex((x) => x.id === id) + 1;
  const nameOf = (id: UniqueIdentifier) => items.find((x) => x.id === id)?.name ?? "";

  async function persist(next: Item[], okMsg: string) {
    const my = ++seq.current;
    setItems(next);
    setSaving(true);
    let r: ActionResult;
    try {
      r = await action({ ok: true }, toFeaturedFormData(next));
    } catch {
      r = { ok: false, formError: "网络异常，未能保存" };
    }
    if (r.ok) committed.current = next;
    if (my !== seq.current) return; // 还有更新的保存在途，由它收尾
    setSaving(false);
    if (r.ok) show(okMsg);
    else {
      setItems(committed.current);
      show(`${r.formError ?? "保存失败"}，已恢复原顺序`, true);
    }
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const pos = (id: UniqueIdentifier | undefined) => (id ? `第 ${numberOf(String(id))} 位` : "原位置");
  const announcements: Announcements = {
    onDragStart: ({ active }) => `已拿起「${nameOf(active.id)}」，当前${pos(active.id)}。`,
    onDragOver: ({ active, over }) => (over ? `「${nameOf(active.id)}」移到${pos(over.id)}。` : `「${nameOf(active.id)}」不在列表范围内。`),
    onDragEnd: ({ active, over }) => (over ? `已放下「${nameOf(active.id)}」，${pos(over.id)}，正在保存。` : `已放下「${nameOf(active.id)}」。`),
    onDragCancel: ({ active }) => `已取消拖动，「${nameOf(active.id)}」回到原位置。`,
  };

  const onStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setOverId(String(e.active.id));
  };
  const onOver = (e: DragOverEvent) => setOverId(e.over ? String(e.over.id) : null);
  const reset = () => {
    setActiveId(null);
    setOverId(null);
  };
  const onEnd = (e: DragEndEvent) => {
    reset();
    if (!e.over || e.over.id === e.active.id) return;
    void persist(moveById(items, String(e.active.id), String(e.over.id)), "顺序已保存");
  };

  const active = activeId ? items.find((x) => x.id === activeId) : undefined;

  return (
    <div className={styles.feditor}>
      <div className={styles.fhead}>
        <span className={styles.hint}>
          拖动整行调整顺序，松手自动保存 · 触屏长按拖动 · 键盘：聚焦 ⠿ 手柄，空格拿起，↑↓ 移动，空格放下，Esc 取消
        </span>
        <span className={styles.saveState} aria-hidden="true">{saving ? "保存中…" : ""}</span>
      </div>
      {items.length === 0 && <p className={styles.hint}>还没有精选，首页将不显示「精选资源」区块。</p>}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[lockX]}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable: "按空格或回车拿起；用上下方向键移动；再按空格或回车放下并自动保存；按 Esc 取消。",
          },
        }}
        onDragStart={onStart}
        onDragOver={onOver}
        onDragEnd={onEnd}
        onDragCancel={reset}
      >
        <SortableContext items={items.map((x) => x.id)} strategy={verticalListSortingStrategy}>
          {/* viewport 是原生滚动容器，dnd-kit 拖到边缘时据此自动滚动 */}
          <ScrollArea className={styles.flist}>
            <ol className={styles.flistOl}>
            {items.map((it) => (
              <SortableRow
                key={it.id}
                item={it}
                index={numberOf(it.id)}
                onRemove={() => void persist(items.filter((x) => x.id !== it.id), `已移除「${it.name}」`)}
              />
            ))}
            </ol>
          </ScrollArea>
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
          {active ? <RowBody item={active} index={numberOf(active.id)} lifted /> : null}
        </DragOverlay>
      </DndContext>
      <div className={styles.toolbar} style={{ marginTop: 16, marginBottom: 0 }}>
        <label className="sr-only" htmlFor="pick">选择要加入精选的资源</label>
        <select id="pick" className={styles.sel} value={pick} onChange={(e) => setPick(e.target.value)} disabled={items.length >= max}>
          <option value="">{pool.length ? "选择已发布资源…" : "没有可加入的已发布资源"}</option>
          {pool.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button
          disabled={!pick || items.length >= max}
          onClick={() => {
            const c = pool.find((x) => x.id === pick);
            setPick("");
            if (c) void persist([...items, c], `已加入「${c.name}」`);
          }}
        >
          + 加入
        </Button>
        <span className={styles.hint}>{items.length}/{max}，首页展示前 6 个</span>
      </div>
      {toast}
    </div>
  );
}

function SortableRow({ item, index, onRemove }: { item: Item; index: number; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const handleRef = useRef<HTMLButtonElement | null>(null);

  // 鼠标/触屏：整行可拖，但从「移除」等按钮上按下不触发；键盘：只认手柄
  const fromControl = (t: EventTarget) => t instanceof Element && !!t.closest("button, a, input, select") && !handleRef.current?.contains(t);
  const rowListeners = {
    onMouseDown: (e: MouseEvent) => {
      if (!fromControl(e.target)) listeners?.onMouseDown?.(e);
    },
    onTouchStart: (e: TouchEvent) => {
      if (!fromControl(e.target)) listeners?.onTouchStart?.(e);
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.target === handleRef.current) listeners?.onKeyDown?.(e);
    },
  };

  return (
    <li
      ref={setNodeRef}
      className={`${styles.fitem} ${isDragging ? styles.fplaceholder : ""}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...rowListeners}
    >
      <RowBody
        item={item}
        index={index}
        handle={
          <button
            type="button"
            ref={(el) => {
              handleRef.current = el;
              setActivatorNodeRef(el);
            }}
            className={styles.grip}
            {...attributes}
            aria-roledescription="可排序项"
            aria-label={`拖动排序：${item.name}，第 ${index} 位`}
          >
            <GripIcon />
          </button>
        }
        onRemove={onRemove}
      />
    </li>
  );
}

function RowBody({
  item,
  index,
  handle,
  onRemove,
  lifted,
}: {
  item: Item;
  index: number;
  handle?: React.ReactNode;
  onRemove?: () => void;
  lifted?: boolean;
}) {
  const inner = (
    <>
      {handle ?? (
        <span className={styles.grip} aria-hidden="true">
          <GripIcon />
        </span>
      )}
      <span className={styles.num} aria-hidden="true">{index}</span>
      <b>
        {item.name}
        {item.note && <span className={styles.hint}>（{item.note}）</span>}
      </b>
      {onRemove ? (
        <button type="button" className={styles.linkBtn} style={{ color: "#9b1e1e" }} onClick={onRemove} aria-label={`移除 ${item.name}`}>
          移除
        </button>
      ) : (
        <span className={styles.linkBtn} style={{ color: "#9b1e1e" }} aria-hidden="true">移除</span>
      )}
    </>
  );
  return lifted ? <div className={`${styles.fitem} ${styles.flifted}`}>{inner}</div> : inner;
}

/** 手绘风六点抓手 */
function GripIcon() {
  return (
    <svg width="14" height="22" viewBox="0 0 14 22" aria-hidden="true" focusable="false">
      {[
        [4, 4],
        [10, 4.5],
        [4.3, 11],
        [10, 11.2],
        [3.8, 18],
        [10.2, 17.6],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" fill="currentColor" />
      ))}
    </svg>
  );
}
