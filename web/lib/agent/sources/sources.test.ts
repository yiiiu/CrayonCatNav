import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { orderAwesome, parseAwesomeMarkdown } from "./awesome";
import { githubQueries, parseGithubSearch } from "./github";
import { hfSpacesUrl, parseHfSpaces } from "./huggingface";
import { parseMcpRegistry } from "./mcp-registry";
import { decodeEntities, extractPageInfo, pageToRaw } from "./page";
import { parseProductHunt } from "./producthunt";

// fixture 取自 2026-10-25 各接口的真实返回（裁剪），测试中不发任何网络请求
const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

describe("MCP Registry 解析", () => {
  const items = parseMcpRegistry(JSON.parse(fixture("mcp-registry.json")));
  it("跳过已删除与只有远程端点的条目，有仓库的排前面", () => {
    expect(items.map((i) => i.title)).toEqual(["Achromat MOM", "Agentic Engineering Periodic System"]);
  });
  it("字段映射正确", () => {
    const a = items[0];
    expect(a.source).toBe("mcp_registry");
    expect(a.githubUrl).toBe("https://github.com/achromat-ai/achromat-mcp-server");
    expect(a.websiteUrl).toBe("https://mom.achromat.ai/");
    expect(a.sourceUrl).toBe("https://registry.modelcontextprotocol.io/v0.1/servers/ai.achromat%2Fmcp-server/versions/latest");
    expect(a.sourceUpdatedAt?.getUTCFullYear()).toBe(2026);
    expect(a.description).toContain("agent tool calls");
  });
  it("结构异常时返回空数组", () => {
    expect(parseMcpRegistry(null)).toEqual([]);
    expect(parseMcpRegistry({ servers: [{ server: { name: "x" } }] })).toEqual([]);
  });
});

describe("GitHub 搜索解析", () => {
  const items = parseGithubSearch(JSON.parse(fixture("github-search.json")));
  it("跳过已归档仓库，homepage 作为官网", () => {
    expect(items).toHaveLength(2);
    expect(items[0].githubUrl).toBe("https://github.com/n8n-io/n8n");
    expect(items[0].websiteUrl).toBe("https://n8n.io/");
    expect(items[0].stars).toBeGreaterThan(100000);
    expect(items[0].hints?.some((h) => h.startsWith("topics："))).toBe(true);
    expect(items.some((i) => i.githubUrl?.includes("old-thing"))).toBe(false);
  });
  const now = new Date("2026-10-25T00:00:00Z");
  it("按分类的主题构造查询：每个主题热门 + 新秀两条，带时间窗口与门槛", () => {
    const qs = githubQueries({ topics: ["mcp-server", "model-context-protocol"], keywords: [] }, now);
    expect(qs).toEqual([
      "topic:mcp-server stars:>=500 pushed:>=2026-09-25 archived:false fork:false",
      "topic:mcp-server stars:>=100 created:>=2026-06-27 archived:false fork:false",
      "topic:model-context-protocol stars:>=500 pushed:>=2026-09-25 archived:false fork:false",
      "topic:model-context-protocol stars:>=100 created:>=2026-06-27 archived:false fork:false",
    ]);
  });
  it("关键词按短语匹配名称/简介/topics，可按分类设门槛", () => {
    const qs = githubQueries({ topics: [], keywords: ['ai "code" review'], minStars: 1000, newMinStars: 200 }, now);
    expect(qs).toEqual([
      '"ai code review" in:name,description,topics stars:>=1000 pushed:>=2026-09-25 archived:false fork:false',
      '"ai code review" in:name,description,topics stars:>=200 created:>=2026-06-27 archived:false fork:false',
    ]);
  });
  it("超过查询上限时按天轮换主题，几天内覆盖全部", () => {
    const topics = ["a1", "a2", "a3", "a4", "a5"];
    const covered = new Set<string>();
    for (let d = 0; d < 3; d++) {
      const qs = githubQueries({ topics, keywords: ["k1"] }, new Date(now.getTime() + d * 86_400_000));
      expect(qs).toHaveLength(8);
      for (const q of qs) covered.add(q.split(" stars")[0]);
    }
    expect(covered).toEqual(new Set([...topics.map((t) => `topic:${t}`), '"k1" in:name,description,topics']));
  });
  it("没有主题和关键词时不生成查询", () => {
    expect(githubQueries({ topics: [], keywords: [] }, now)).toEqual([]);
  });
});

describe("Hugging Face 查询地址", () => {
  it("有搜索词时用 search 参数，按点赞取 30 个；无搜索词取全站前 100", () => {
    const u = new URL(hfSpacesUrl("text to"));
    expect(u.origin + u.pathname).toBe("https://huggingface.co/api/spaces");
    expect(u.searchParams.get("search")).toBe("text to");
    expect(u.searchParams.get("sort")).toBe("likes");
    expect(u.searchParams.get("limit")).toBe("30");
    expect(u.searchParams.getAll("expand[]")).toContain("cardData");
    const all = new URL(hfSpacesUrl());
    expect(all.searchParams.has("search")).toBe(false);
    expect(all.searchParams.get("limit")).toBe("100");
  });
});

describe("awesome 清单解析", () => {
  const md = fixture("awesome-mcp-servers.md");
  const items = parseAwesomeMarkdown(md, "punkpeye/awesome-mcp-servers");
  it("只收正文章节的列表项，跳过目录、教程、社区", () => {
    expect(items.some((i) => i.title.includes("Quickstart"))).toBe(false);
    expect(items.some((i) => i.title.includes("Reddit"))).toBe(false);
    expect(items[0].githubUrl).toBe("https://github.com/inth3shadows/terse");
    expect(items.some((i) => i.githubUrl === "https://github.com/Nyrok/flompt")).toBe(true); // Frameworks 章节
  });
  it("说明去掉徽章与图标，记录分组与官方标记", () => {
    const terse = items[0];
    expect(terse.description.startsWith("Transparent proxy")).toBe(true);
    expect(terse.description).not.toContain("glama.ai");
    expect(terse.hints).toContain("分组：Aggregators");
    expect(items.filter((i) => i.hints?.includes("清单标注为官方实现")).length).toBeGreaterThan(0);
  });
  it("内联小样：@前缀、非 GitHub https 链接、http 链接", () => {
    const small = `## Server Implementations\n### Tools\n- [@scope/pkg](https://github.com/scope/pkg) 📇 - 说明 **加粗**\n- [Site](https://example.com/x) - 官网条目\n- [Old](http://insecure.example.com) - 跳过\n- [Dup](https://github.com/Scope/Pkg) - 重复\n## Tips and Tricks\n- [Not](https://github.com/not/me) - 不收`;
    const r = parseAwesomeMarkdown(small, "x/y");
    expect(r.map((i) => i.title)).toEqual(["scope/pkg", "Site"]);
    expect(r[0].description).toBe("说明 加粗");
    expect(r[1].websiteUrl).toBe("https://example.com/x");
  });
  it("排序：官方实现优先，按日期轮换", () => {
    const ordered = orderAwesome(items, new Date("2026-10-25T00:00:00Z"));
    expect(ordered).toHaveLength(items.length);
    expect(ordered[0].hints).toContain("清单标注为官方实现");
  });
});

describe("Hugging Face Spaces 解析", () => {
  it("映射 Space 链接与点赞数", () => {
    const items = parseHfSpaces(JSON.parse(fixture("hf-spaces.json")));
    expect(items[0]).toMatchObject({ source: "huggingface", title: "DeepSite v4", websiteUrl: "https://huggingface.co/spaces/enzostvs/deepsite", githubUrl: null, stars: 16604 });
    expect(items[0].hints?.join(" ")).not.toContain("region:");
    expect(parseHfSpaces([{ id: "../x" }, { id: "a/b", private: true }])).toEqual([]);
  });
});

describe("Product Hunt 解析", () => {
  it("按 GraphQL v2 结构映射", () => {
    const json = {
      data: {
        posts: {
          edges: [
            {
              node: {
                id: "1",
                name: "Foo AI",
                tagline: "Write docs with AI",
                description: "Longer text",
                url: "https://www.producthunt.com/posts/foo-ai?utm_campaign=x",
                website: "https://www.producthunt.com/r/abc",
                votesCount: 321,
                createdAt: "2026-10-20T08:00:00Z",
                topics: { edges: [{ node: { name: "Artificial Intelligence" } }] },
              },
            },
            { node: { name: "", url: "https://x" } },
          ],
        },
      },
    };
    const items = parseProductHunt(json);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ source: "producthunt", title: "Foo AI", sourceUrl: "https://www.producthunt.com/posts/foo-ai", websiteUrl: "https://www.producthunt.com/r/abc", stars: 321 });
    expect(items[0].description).toBe("Write docs with AI — Longer text");
  });
  it("token 无效时抛出可读错误", () => {
    expect(() => parseProductHunt({ data: null, errors: [{ error: "invalid_oauth_token" }] })).toThrow(/invalid_oauth_token/);
  });
});

describe("网页信息提取", () => {
  const html = `<!doctype html><html><head><title>Foo &amp; Bar | 官网</title>
    <meta content="AI 写作助手 &#x2014; 快速" name="description">
    <meta property="og:site_name" content="FooBar">
    <script>var secret = "x";</script><style>.a{}</style></head>
    <body><nav>菜单</nav><h1>欢迎</h1><p>第一段&nbsp;介绍</p><!-- 注释 --></body></html>`;
  it("取标题、描述与正文，不含脚本样式", () => {
    const info = extractPageInfo(html);
    expect(info.title).toBe("Foo & Bar | 官网");
    expect(info.description).toBe("AI 写作助手 — 快速");
    expect(info.siteName).toBe("FooBar");
    expect(info.text).toContain("第一段 介绍");
    expect(info.text).not.toContain("secret");
    expect(info.text).not.toContain("注释");
  });
  it("转成原始候选", () => {
    const raw = pageToRaw(html, "https://www.foobar.ai/");
    expect(raw).toMatchObject({ source: "manual", title: "FooBar", websiteUrl: "https://www.foobar.ai/", githubUrl: null });
    expect(pageToRaw(html, "http://foobar.ai/").websiteUrl).toBeNull();
  });
  it("实体解码", () => {
    expect(decodeEntities("&lt;a&gt; &#39;x&#39; &unknown;")).toBe("<a> 'x' &unknown;");
  });
});
