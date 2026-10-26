"use client";

import { useActionState, useState } from "react";
import { Button, Card, ScrollArea, Select } from "@/components/ui";
import type { ActionResult } from "@/lib/domain/result";
import { pricingLabels, pricingTypes, statusLabels } from "@/lib/validation/resource";
import { LIMITS, platformLabels, platforms, type ResourceDetails } from "@/lib/validation/resource-details";
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
  previewImageUrl: string;
  details: ResourceDetails;
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
    <ScrollArea className={styles.formArea} viewportClassName={styles.formVp}>
      <form action={formAction} className={styles.form} noValidate>
        <input type="hidden" name="prevSlug" value={initial.slug} />
        <Card className={styles.fill}>
          {!state.ok && state.formError && <p className={styles.alert} role="alert">{state.formError}</p>}
          {state.ok && (state.message || notice) && <p className={styles.ok} role="status">{state.message ?? notice}</p>}
          <h2 className={styles.cardTitle}>基本信息</h2>
          <ScrollArea className={`${styles.body} ${styles.formBody}`} viewportClassName={`${styles.two} ${styles.formBodyVp}`}>
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
              <Select
                id="f-categoryId"
                name="categoryId"
                defaultValue={initial.categoryId}
                invalid={!!err("categoryId")}
                aria-describedby={describedBy("categoryId")}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
            </Field>
            <Field label="定价类型" name="pricingType">
              <Select
                id="f-pricingType"
                name="pricingType"
                defaultValue={initial.pricingType}
                options={pricingTypes.map((p) => ({ value: p, label: pricingLabels[p] }))}
              />
            </Field>
            <Field label="官网链接" name="websiteUrl" error={err("websiteUrl")} hint="仅支持 https://">
              <input id="f-websiteUrl" name="websiteUrl" type="url" inputMode="url" placeholder="https://" defaultValue={initial.websiteUrl} aria-invalid={!!err("websiteUrl")} aria-describedby={describedBy("websiteUrl")} />
            </Field>
            <Field label="GitHub 链接" name="githubUrl" error={err("githubUrl")} hint="https://github.com/所有者/仓库">
              <input id="f-githubUrl" name="githubUrl" type="url" inputMode="url" placeholder="https://github.com/" defaultValue={initial.githubUrl} aria-invalid={!!err("githubUrl")} aria-describedby={describedBy("githubUrl")} />
            </Field>
            <Field label="核心功能" name="highlights" error={err("details")} wide hint={`每行一条，一句话一个能力，最多 ${LIMITS.highlights} 条`}>
              <textarea id="f-highlights" name="highlights" rows={4} defaultValue={initial.details.highlights.join("\n")} />
            </Field>
            <Field label="适合谁 / 典型场景" name="useCases" wide hint={`每行一条，最多 ${LIMITS.useCases} 条`}>
              <textarea id="f-useCases" name="useCases" rows={3} defaultValue={initial.details.useCases.join("\n")} />
            </Field>
            <Field label="快速上手" name="quickstart" wide hint="安装命令或配置片段，前台按代码块原样展示并可一键复制">
              <textarea id="f-quickstart" name="quickstart" rows={4} spellCheck={false} className={styles.mono} defaultValue={initial.details.quickstart} />
            </Field>
            <Field label="定价说明" name="pricingNote" hint="如：免费 50 次/月，Pro $20/月">
              <input id="f-pricingNote" name="pricingNote" maxLength={LIMITS.pricingNote} defaultValue={initial.details.pricingNote} />
            </Field>
            <Field label="官网预览图" name="previewImageUrl" error={err("previewImageUrl")} hint="官网 og:image 的 https 地址，采集时自动抓取">
              <input id="f-previewImageUrl" name="previewImageUrl" type="url" inputMode="url" placeholder="https://" defaultValue={initial.previewImageUrl} aria-invalid={!!err("previewImageUrl")} />
            </Field>
            <fieldset className={`${styles.field} ${styles.wide}`} style={{ border: 0, padding: 0 }}>
              <legend>支持平台</legend>
              <div className={styles.checksInline}>
                {platforms.map((p) => (
                  <label key={p} className={styles.check}>
                    <input type="checkbox" name="platforms" value={p} defaultChecked={initial.details.platforms.includes(p)} />
                    {platformLabels[p]}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className={`${styles.field} ${styles.wide} ${err("tagIds") ? styles.bad : ""}`} style={{ border: 0, padding: 0 }}>
              <legend>标签</legend>
              <ScrollArea className={styles.checks} viewportClassName={styles.checksVp}>
                {tags.length === 0 && <span className={styles.hint}>还没有标签，先去「分类标签」新增</span>}
                {tags.map((t) => (
                  <label key={t.id} className={styles.check}>
                    <input type="checkbox" name="tagIds" value={t.id} defaultChecked={initial.tagIds.includes(t.id)} />
                    {t.name}
                  </label>
                ))}
              </ScrollArea>
              {err("tagIds") && <p className={styles.err} role="alert">{err("tagIds")}</p>}
            </fieldset>
          </ScrollArea>
        </Card>

        <div className={styles.panel}>
          <ScrollArea className={styles.panelScroll} viewportClassName={styles.panelScrollVp}>
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
          </ScrollArea>
          <div className={styles.btns}>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "保存中…" : "保存"}
            </Button>
          </div>
        </div>
      </form>
    </ScrollArea>
  );
}
