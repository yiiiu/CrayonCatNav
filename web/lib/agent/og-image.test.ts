import { describe, expect, it } from "vitest";
import { extractOgImage } from "./og-image";

describe("extractOgImage", () => {
  it("优先 og:image 并补全相对地址", () => {
    const html = `<meta name="twitter:image" content="https://a.com/t.png"><meta property="og:image" content="/og.png?a=1&amp;b=2">`;
    expect(extractOgImage(html, "https://a.com/x")).toBe("https://a.com/og.png?a=1&b=2");
  });
  it("content 在前也能识别", () => {
    expect(extractOgImage(`<meta content="https://c.com/i.jpg" property="og:image" />`, "https://c.com")).toBe("https://c.com/i.jpg");
  });
  it("拒绝 http 与缺失", () => {
    expect(extractOgImage(`<meta property="og:image" content="http://a.com/x.png">`, "https://a.com")).toBeNull();
    expect(extractOgImage(`<title>x</title>`, "https://a.com")).toBeNull();
  });
});
