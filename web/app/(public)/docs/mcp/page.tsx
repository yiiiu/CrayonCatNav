import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/CodeBlock";
import styles from "@/components/docs/docs.module.css";
import { Tabs } from "@/components/docs/Tabs";
import { mcpUrl } from "@/lib/docs/urls";

export const metadata: Metadata = {
  title: "MCP 接入",
  description: "把蜡笔猫导航的 MCP 服务接入 Claude Code、Cursor、VS Code、Codex，让 Agent 直接查询收录的 AI 资源。",
  alternates: { canonical: "/docs/mcp" },
};

const NAME = "crayoncat";

export default function McpDocs() {
  const url = mcpUrl();
  const json = (key: string, extra: Record<string, string> = {}) => JSON.stringify({ [key]: { [NAME]: { ...extra, url } } }, null, 2);
  const clients = [
    {
      id: "claude-code",
      label: "Claude Code",
      content: (
        <>
          <p>在终端运行（加 <code>--scope user</code> 可在所有项目里使用）：</p>
          <CodeBlock label="终端" code={`claude mcp add --transport http ${NAME} ${url}`} />
          <p>运行 <code>claude mcp list</code> 看到 {NAME} 即接入成功。</p>
        </>
      ),
    },
    {
      id: "cursor",
      label: "Cursor",
      content: (
        <>
          <p>写入 <code>~/.cursor/mcp.json</code>（全局）或项目里的 <code>.cursor/mcp.json</code>：</p>
          <CodeBlock label="mcp.json" code={json("mcpServers")} />
        </>
      ),
    },
    {
      id: "vscode",
      label: "VS Code",
      content: (
        <>
          <p>写入项目里的 <code>.vscode/mcp.json</code>，然后在 Copilot Chat 的 Agent 模式里启用：</p>
          <CodeBlock label=".vscode/mcp.json" code={json("servers", { type: "http" })} />
        </>
      ),
    },
    {
      id: "codex",
      label: "Codex",
      content: (
        <>
          <p>用命令添加：</p>
          <CodeBlock label="终端" code={`codex mcp add ${NAME} --url ${url}`} />
          <p>或者写入 <code>~/.codex/config.toml</code>：</p>
          <CodeBlock label="config.toml" code={`[mcp_servers.${NAME}]\nurl = "${url}"`} />
        </>
      ),
    },
    {
      id: "other",
      label: "其他客户端",
      content: (
        <>
          <p>支持远程 MCP（Streamable HTTP）的客户端，直接填服务地址即可。只支持本地 stdio 的客户端，可以用 mcp-remote 转接：</p>
          <CodeBlock label="mcp.json" code={JSON.stringify({ mcpServers: { [NAME]: { command: "npx", args: ["-y", "mcp-remote", url] } } }, null, 2)} />
        </>
      ),
    },
  ];

  return (
    <>
      <h1>MCP 接入</h1>
      <p className={styles.lead}>一行配置，让支持 MCP 的 Agent 直接查询蜡笔猫导航。无需注册，无需 API Key。</p>

      <h2>服务地址</h2>
      <CodeBlock code={url} />
      <p>传输方式为 Streamable HTTP，无状态；所有工具都是只读的。</p>

      <h2>在客户端中配置</h2>
      <Tabs label="选择客户端" items={clients} />

      <h2>试一试</h2>
      <p>接入后，直接对 Agent 说：</p>
      <CodeBlock code="用 crayoncat 在蜡笔猫导航里找一个适合 React 项目的无样式组件库，比较一下前三个，告诉我怎么安装。" />
      <p>Agent 一般会这样调用：</p>
      <ol>
        <li><code>list_categories</code>：发现「UI 组件库」分类（<code>ui-components</code>）</li>
        <li><code>search_resources</code>：<code>{`{ "category": "ui-components", "query": "React 无样式" }`}</code></li>
        <li><code>get_resource</code>：查看候选的详情和快速上手</li>
      </ol>

      <h2>工具说明</h2>
      <div className={styles.tblWrap}>
        <table className={styles.tbl}>
          <thead>
            <tr><th scope="col">工具</th><th scope="col">参数</th><th scope="col">返回</th></tr>
          </thead>
          <tbody>
            <tr><td><code>list_categories</code></td><td>无</td><td>分类 slug、名称、收录数量</td></tr>
            <tr><td><code>list_tags</code></td><td><code>category</code>（可选）</td><td>常用标签，按使用量排序，最多 50 个</td></tr>
            <tr>
              <td><code>search_resources</code></td>
              <td><code>query</code>、<code>category</code>、<code>tags</code>、<code>pricing</code>、<code>limit</code>（1–20，默认 10）、<code>cursor</code>，均可选</td>
              <td>精简列表、总数、下一页 <code>nextCursor</code></td>
            </tr>
            <tr><td><code>get_resource</code></td><td><code>slug</code></td><td>详情、快速上手、站内配套工具链接</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        参数和返回字段与 <Link href="/docs/api">HTTP API</Link> 完全一致。
      </p>

      <h2>调试</h2>
      <p>可以用官方的 MCP Inspector 连接服务地址，查看工具列表并手动调用：</p>
      <CodeBlock label="终端" code="npx @modelcontextprotocol/inspector" />
      <p className={styles.note}>遇到 429 说明请求太频繁，等待 Retry-After 指定的秒数后再试。</p>
    </>
  );
}
