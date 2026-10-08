import { parse as parseToml } from "smol-toml";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { convert } from "./logic";

const SAMPLE = '{\n  "name": "crayon-cat",\n  "version": 1,\n  "tags": ["ai", "mcp"],\n  "debug": false,\n  "owner": null,\n  "nested": { "a": { "b": [1, 2, { "c": true }] } }\n}';

function ok(r: ReturnType<typeof convert>) {
  if (!r.ok) throw new Error(`期望成功：${r.error.message}`);
  return r;
}

describe("数据格式转换", () => {
  it("JSON → YAML：嵌套/布尔/null 保持，结果可解析", () => {
    const r = ok(convert(SAMPLE, "json", "yaml"));
    expect(parseYaml(r.output)).toEqual(JSON.parse(SAMPLE));
    expect(r.keyCount).toBe(6);
    expect(r.warnings).toEqual([]);
  });

  it("JSON → TOML：null 字段省略并提示，其余可解析", () => {
    const r = ok(convert(SAMPLE, "json", "toml"));
    const back = parseToml(r.output) as Record<string, unknown>;
    expect(back.name).toBe("crayon-cat");
    expect(back.debug).toBe(false);
    expect("owner" in back).toBe(false);
    expect(r.warnings.join()).toContain("owner");
  });

  it("YAML（含注释）→ TOML：提示注释丢失", () => {
    const r = ok(convert("# 配置\nname: crayon-cat\nversion: 1\n", "yaml", "toml"));
    expect(r.output).toContain('name = "crayon-cat"');
    expect(r.warnings.some((w) => w.includes("注释"))).toBe(true);
  });

  it("TOML → JSON：日期转 ISO 字符串并提示，大整数转字符串", () => {
    const r = ok(convert("d = 1979-05-27T07:32:00Z\nbig = 9223372036854775807\n", "toml", "json"));
    const o = JSON.parse(r.output);
    expect(o.d).toBe("1979-05-27T07:32:00.000Z");
    expect(o.big).toBe("9223372036854775807");
    expect(r.warnings.length).toBe(2);
  });

  it("YAML 往返 JSON 一致", () => {
    const y = ok(convert(SAMPLE, "json", "yaml")).output;
    const j = ok(convert(y, "yaml", "json")).output;
    expect(JSON.parse(j)).toEqual(JSON.parse(SAMPLE));
  });

  it("非法 JSON：给出行列号与中文提示", () => {
    const r = convert('{\n  "name": "crayon-cat"\n  "version": 1\n}', "json", "yaml");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.line).toBe(3);
    expect(r.error.column).toBeGreaterThan(0);
    expect(r.error.message).toMatch(/逗号/);
  });

  it("非法 YAML / TOML：带行号", () => {
    const y = convert("a: 1\na: 2\n", "yaml", "json");
    expect(y.ok).toBe(false);
    if (!y.ok) expect(y.error.line).toBe(2);
    const t = convert("a = 1\nb = = 2\n", "toml", "json");
    expect(t.ok).toBe(false);
    if (!t.ok) expect(t.error.line).toBe(2);
  });

  it("空输入与 TOML 顶层数组被拒绝", () => {
    expect(convert("   ", "json", "yaml").ok).toBe(false);
    const r = convert("[1, 2]", "json", "toml");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain("顶层");
  });

  it("TOML 数组中的 null 无法表示，报错而非静默丢弃", () => {
    const r = convert('{"a": [1, null]}', "json", "toml");
    expect(r.ok).toBe(false);
  });

  it("引号与反斜杠在三种格式间保真", () => {
    const src = JSON.stringify({ path: 'C:\\Users\\me', quote: 'say "hi"' });
    for (const to of ["yaml", "toml"] as const) {
      const out = ok(convert(src, "json", to)).output;
      const back = ok(convert(out, to, "json")).output;
      expect(JSON.parse(back)).toEqual(JSON.parse(src));
    }
  });
});
