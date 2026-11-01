import assert from "node:assert/strict";
import { test } from "node:test";
import { buildUrl, format, parseArgs, run } from "../lib/cli.mjs";

const B = "https://x.dev";

test("parseArgs：位置参数、可重复 tag、--k=v、短选项", () => {
  const p = parseArgs(["search", "react", "组件", "--tag", "a", "--tag=b", "--limit=3", "--json", "-h"]);
  assert.equal(p.command, "search");
  assert.deepEqual(p.positional, ["react", "组件"]);
  assert.deepEqual(p.flags.tag, ["a", "b"]);
  assert.equal(p.flags.limit, "3");
  assert.equal(p.flags.json, true);
  assert.equal(p.flags.help, true);
  assert.throws(() => parseArgs(["search", "--foo"]), /未知选项/);
  assert.throws(() => parseArgs(["search", "--category"]), /需要一个值/);
});

test("buildUrl", () => {
  assert.equal(buildUrl(B + "/", "categories", [], { tag: [] }), `${B}/api/agent/v1/categories`);
  assert.equal(buildUrl(B, "tags", [], { tag: [], category: "mcp" }), `${B}/api/agent/v1/tags?category=mcp`);
  const u = new URL(buildUrl(B, "search", ["React", "无样式"], { tag: ["a", "b"], category: "ui-components", limit: "5" }));
  assert.equal(u.pathname, "/api/agent/v1/resources");
  assert.equal(u.searchParams.get("q"), "React 无样式");
  assert.deepEqual(u.searchParams.getAll("tag"), ["a", "b"]);
  assert.equal(buildUrl(B, "show", ["a/b"], { tag: [] }), `${B}/api/agent/v1/resources/a%2Fb`);
  assert.throws(() => buildUrl(B, "show", [], { tag: [] }), /用法/);
  assert.throws(() => buildUrl(B, "nope", [], { tag: [] }), /未知命令/);
});

test("format：空结果给出建议，翻页提示", () => {
  assert.match(format("search", { items: [], total: 0, nextCursor: null }), /没有找到/);
  const s = format("search", {
    total: 3,
    nextCursor: "1",
    items: [{ slug: "radix", name: "Radix", summary: "原语", category: "ui-components", pricing: "free", tags: ["react"], websiteUrl: null, githubUrl: "https://github.com/radix-ui/primitives", url: "u" }],
  });
  assert.match(s, /Radix {2}\[radix\]/);
  assert.match(s, /--cursor 1/);
});

const fakeFetch = (status, body) => async () => ({ ok: status < 400, status, json: async () => body });

test("run：--json 原样输出，错误码映射", async () => {
  const out = [];
  const err = [];
  const io = { env: {}, out: (s) => out.push(s), err: (s) => err.push(s) };
  assert.equal(await run(["categories", "--json"], { ...io, fetchImpl: fakeFetch(200, { ok: true, categories: [] }) }), 0);
  assert.deepEqual(JSON.parse(out[0]), { ok: true, categories: [] });
  assert.equal(await run(["show", "nope"], { ...io, fetchImpl: fakeFetch(404, { ok: false, code: "not_found", message: "没有找到资源 nope" }) }), 4);
  assert.match(err.at(-1), /没有找到/);
  assert.equal(await run(["search", "--bad"], { ...io, fetchImpl: fakeFetch(200, {}) }), 2);
  assert.equal(await run([], { ...io, fetchImpl: fakeFetch(200, {}) }), 0);
  assert.match(out.at(-1), /用法/);
});

test("run：CRAYONCAT_BASE_URL 生效", async () => {
  let seen = "";
  await run(["categories"], { env: { CRAYONCAT_BASE_URL: "https://preview.dev" }, out: () => {}, err: () => {}, fetchImpl: async (u) => ((seen = u), { ok: true, status: 200, json: async () => ({ ok: true, categories: [] }) }) });
  assert.equal(seen, "https://preview.dev/api/agent/v1/categories");
});
