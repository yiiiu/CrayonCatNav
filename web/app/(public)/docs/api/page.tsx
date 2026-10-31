import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/CodeBlock";
import styles from "@/components/docs/docs.module.css";
import { SEARCH_LIMIT_DEFAULT, SEARCH_LIMIT_MAX } from "@/lib/agent-api/core";
import { apiBase, siteOrigin } from "@/lib/docs/urls";

export const metadata: Metadata = {
  title: "HTTP API",
  description: "蜡笔猫导航 Agent HTTP API 参考：分类、标签、资源搜索与详情接口。",
  alternates: { canonical: "/docs/api" },
};

export default function ApiDocs() {
  const base = apiBase();
  const o = siteOrigin();
  const listExample = JSON.stringify(
    {
      ok: true,
      total: 12,
      nextCursor: "3",
      items: [
        {
          slug: "shadcn-ui",
          name: "shadcn/ui",
          summary: "可复制进项目的 React 组件集合，基于 Radix 与 Tailwind",
          category: "ui-components",
          tags: ["react", "tailwind"],
          pricing: "free",
          websiteUrl: "https://ui.shadcn.com",
          githubUrl: "https://github.com/shadcn-ui/ui",
          url: `${o}/resources/shadcn-ui`,
        },
      ],
    },
    null,
    2,
  );
  const detailExample = JSON.stringify(
    {
      ok: true,
      slug: "shadcn-ui",
      name: "shadcn/ui",
      summary: "…",
      description: "…",
      category: { slug: "ui-components", name: "UI 组件库" },
      tags: [{ slug: "react", name: "React" }],
      pricing: "free",
      pricingNote: null,
      websiteUrl: "https://ui.shadcn.com",
      githubUrl: "https://github.com/shadcn-ui/ui",
      url: `${o}/resources/shadcn-ui`,
      highlights: ["…"],
      useCases: ["…"],
      platforms: ["web"],
      quickstart: "npx shadcn@latest init",
      siteTools: [],
      updatedAt: "2026-10-30T08:00:00.000Z",
    },
    null,
    2,
  );

  return (
    <>
      <h1>HTTP API</h1>
      <p className={styles.lead}>只读 JSON 接口，MCP、Skill、CLI 底层都用它。无需注册和 API Key，支持跨域调用。</p>

      <h2>基础信息</h2>
      <CodeBlock code={base} />
      <ul>
        <li>只有 GET 请求，返回 JSON；成功时 <code>ok: true</code>。</li>
        <li>
          失败时返回 <code>{`{ "ok": false, "code": "…", "message": "…" }`}</code>，<code>message</code> 会说明哪个参数有问题。
        </li>
        <li>结果可能有最多 1 分钟的缓存。</li>
      </ul>

      <h2>GET /categories</h2>
      <p>列出有已发布资源的分类。</p>
      <CodeBlock label="示例" code={`curl ${base}/categories`} />
      <CodeBlock label="返回" code={JSON.stringify({ ok: true, categories: [{ slug: "ui-components", name: "UI 组件库", count: 12 }] }, null, 2)} />

      <h2>GET /tags</h2>
      <p>列出常用标签，按使用量排序，最多 50 个。</p>
      <div className={styles.tblWrap}>
        <table className={styles.tbl}>
          <thead><tr><th scope="col">参数</th><th scope="col">说明</th></tr></thead>
          <tbody><tr><td><code>category</code></td><td>可选，只看某个分类的标签</td></tr></tbody>
        </table>
      </div>
      <CodeBlock label="示例" code={`curl "${base}/tags?category=ui-components"`} />

      <h2>GET /resources</h2>
      <p>筛选资源。所有参数都可选；有关键词时只返回命中的资源，按相关度排序，否则按精选和更新时间排序。</p>
      <div className={styles.tblWrap}>
        <table className={styles.tbl}>
          <thead><tr><th scope="col">参数</th><th scope="col">说明</th></tr></thead>
          <tbody>
            <tr><td><code>q</code></td><td>关键词或一句需求描述，中英文均可，最多 100 字</td></tr>
            <tr><td><code>category</code></td><td>分类 slug</td></tr>
            <tr><td><code>tag</code></td><td>标签 slug，可重复传多个（需同时具备），最多 5 个；也可用 <code>tags=a,b</code></td></tr>
            <tr><td><code>pricing</code></td><td><code>free</code> / <code>freemium</code> / <code>paid</code></td></tr>
            <tr><td><code>limit</code></td><td>每页条数，1–{SEARCH_LIMIT_MAX}，默认 {SEARCH_LIMIT_DEFAULT}</td></tr>
            <tr><td><code>cursor</code></td><td>翻页：传上一页返回的 <code>nextCursor</code></td></tr>
          </tbody>
        </table>
      </div>
      <CodeBlock label="示例" code={`curl "${base}/resources?category=ui-components&q=React%20无样式&limit=3"`} />
      <CodeBlock label="返回" code={listExample} />
      <p><code>pricing</code> 为 <code>null</code> 表示价格类型未知；<code>nextCursor</code> 为 <code>null</code> 表示没有下一页。</p>

      <h2>GET /resources/{"{slug}"}</h2>
      <p>资源详情。<code>quickstart</code> 是安装命令或配置片段，没有时为 <code>null</code>；<code>siteTools</code> 是本站可直接使用的配套工具（如已预填的 MCP 配置生成器）。</p>
      <CodeBlock label="示例" code={`curl ${base}/resources/shadcn-ui`} />
      <CodeBlock label="返回" code={detailExample} />

      <h2>错误码</h2>
      <div className={styles.tblWrap}>
        <table className={styles.tbl}>
          <thead><tr><th scope="col">HTTP</th><th scope="col">code</th><th scope="col">说明</th></tr></thead>
          <tbody>
            <tr><td>400</td><td><code>invalid_input</code></td><td>参数不合法，看 <code>message</code></td></tr>
            <tr><td>404</td><td><code>not_found</code></td><td>资源不存在或未发布</td></tr>
            <tr><td>429</td><td><code>rate_limited</code></td><td>请求太频繁，按 <code>Retry-After</code> 等待后重试</td></tr>
            <tr><td>500</td><td><code>error</code></td><td>服务出错，稍后再试</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
