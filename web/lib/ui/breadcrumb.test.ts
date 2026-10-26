import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, safeJson } from "./breadcrumb";

describe("breadcrumbJsonLd", () => {
  const ld = breadcrumbJsonLd(
    [{ label: "发现", href: "/resources" }, { label: "MCP 服务", href: "/resources?cat=mcp" }, { label: "Filesystem MCP" }],
    "https://example.com",
  );
  it("按顺序编号并补全绝对地址", () => {
    expect(ld.itemListElement.map((x) => x.position)).toEqual([1, 2, 3]);
    expect(ld.itemListElement[1]).toMatchObject({ name: "MCP 服务", item: "https://example.com/resources?cat=mcp" });
  });
  it("当前页不带 item", () => {
    expect(ld.itemListElement[2]).not.toHaveProperty("item");
  });
});

describe("safeJson", () => {
  it("转义 <", () => expect(safeJson({ a: "</script>" })).not.toContain("</"));
});
