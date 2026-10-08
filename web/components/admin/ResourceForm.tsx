"use client";

import { useActionState, useState } from "react";
import { Button, Card } from "@/components/ui";
import type { ActionResult } from "@/lib/domain/result";
import { pricingLabels, pricingTypes, statusLabels } from "@/lib/validation/resource";
import { suggestSlug } from "@/lib/validation/search";
import styles from "./admin.module.css";
import { Field } from "./Field";

export type ResourceFormValues = {
  slug: string;
  name: string;
  summary: string;
  description: string;
  categoryId: string;
  websiteUrl: string;
  githubUrl: string;
  iconUrl: string;
  pricingType: (typeof pricingTypes)[number];
  status: keyof typeof statusLabels;
  tagIds: string[];
  toolIds: string[];
};

type Props = {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  initial: ResourceFormValues;
  categories: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  tools: { id: string; name: string }[];
  notice?: string;
};

export function ResourceForm({ action, initial, categories, tags, tools, notice }: Props) {
  const [state, formAction, pending] = useActionState(action, { ok: true } as ActionResult);
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);
  const suggestion = suggestSlug(name);
  const describedBy = (k: string) => (err(k) ? `f-${k}-err` : undefined);

  return (
    <form action={formAction} className={styles.form} noValidate>
      <input type="hidden" name="prevSlug" value={initial.slug} />
      <Card>
        {!state.ok && state.formError && <p className={styles.alert} role="alert">{state.formError}</p>}
        {state.ok && (state.message || notice) && <p className={styles.ok} role="status">{state.message ?? notice}</p>}
        <h2 className={styles.cardTitle}>基本信息</h2>
        <div className={styles.two}>
          <Field label="名称" name="name" error={err("name")}>
            <input id="f-name" name="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!err("name")} aria-describedby={describedBy("name")} />
          </Field>
          <Field
            label="slug"
            name="slug"
            error={err("slug")}
            hint={
              suggestion && suggestion !== slug ? (
                <span className={styles.sugg}>
                  建议：<button type="button" className={styles.linkBtn} onClick={() => setSlug(suggestion)}>{suggestion}</button>
                </span>
              ) : (
                "小写字母、数字和 -，用于网址"
              )
            }
          >
            <input id="f-slug" name="slug" required value={slug} onChange={(e) => setSlug(e.target.value)} aria-invalid={!!err("slug")} aria-describedby={describedBy("slug")} />
          </Field>
          <Field label="简介" name="summary" error={err("summary")} wide hint="一句话说明它是什么、解决什么问题（≤200 字）">
            <input id="f-summary" name="summary" required maxLength={200} defaultValue={initial.summary} aria-invalid={!!err("summary")} aria-describedby={describedBy("summary")} />
          </Field>
          <Field label="描述" name="description" error={err("description")} wide hint="空一行分段；只写核实过的信息">
            <textarea id="f-description" name="description" defaultValue={initial.description} />
          </Field>
          <Field label="分类" name="categoryId" error={err("categoryId")}>
            <select id="f-categoryId" name="categoryId" defaultValue={initial.categoryId} aria-invalid={!!err("categoryId")}>
              <option value="">请选择</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="定价类型" name="pricingType">
            <select id="f-pricingType" name="pricingType" defaultValue={initial.pricingType}>
              {pricingTypes.map((p) => <option key={p} value={p}>{pricingLabels[p]}</option>)}
            </select>
          </Field>
          <Field label="官网链接" name="websiteUrl" error={err("websiteUrl")} hint="仅支持 https://">
            <input id="f-websiteUrl" name="websiteUrl" type="url" inputMode="url" placeholder="https://" defaultValue={initial.websiteUrl} aria-invalid={!!err("websiteUrl")} aria-describedby={describedBy("websiteUrl")} />
          </Field>
          <Field label="GitHub 链接" name="githubUrl" error={err("githubUrl")} hint="https://github.com/所有者/仓库">
            <input id="f-githubUrl" name="githubUrl" type="url" inputMode="url" placeholder="https://github.com/" defaultValue={initial.githubUrl} aria-invalid={!!err("githubUrl")} aria-describedby={describedBy("githubUrl")} />
          </Field>
          <fieldset className={`${styles.field} ${styles.wide} ${err("tagIds") ? styles.bad : ""}`} style={{ border: 0, padding: 0 }}>
            <legend>标签</legend>
            <div className={styles.checks}>
              {tags.length === 0 && <span className={styles.hint}>还没有标签，先去「分类标签」新增</span>}
              {tags.map((t) => (
                <label key={t.id} className={styles.check}>
                  <input type="checkbox" name="tagIds" value={t.id} defaultChecked={initial.tagIds.includes(t.id)} />
                  {t.name}
                </label>
              ))}
            </div>
            {err("tagIds") && <p className={styles.err} role="alert">{err("tagIds")}</p>}
          </fieldset>
        </div>
      </Card>

      <div className={styles.panel}>
        <Card>
          <h2 className={styles.cardTitle}>发布状态</h2>
          {(Object.keys(statusLabels) as (keyof typeof statusLabels)[]).map((s) => (
            <label key={s} className={styles.opt}>
              <input type="radio" name="status" value={s} defaultChecked={initial.status === s} />
              {statusLabels[s]}
            </label>
          ))}
          <p className={styles.hint}>发布需要：至少一个链接和一个标签。下架后前台立即不可见。</p>
        </Card>
        <Card>
          <h2 className={styles.cardTitle}>关联工具</h2>
          {tools.map((t) => (
            <label key={t.id} className={styles.opt}>
              <input type="checkbox" name="toolIds" value={t.id} defaultChecked={initial.toolIds.includes(t.id)} />
              {t.name}
            </label>
          ))}
        </Card>
        <div className={styles.btns}>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>
    </form>
  );
}
