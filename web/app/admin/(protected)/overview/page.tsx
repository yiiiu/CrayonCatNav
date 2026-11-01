import { connection } from "next/server";
import { Suspense } from "react";
import { AdminTop } from "@/components/admin/AdminTop";
import styles from "@/components/admin/admin.module.css";
import { Bars } from "@/components/admin/overview/Bars";
import ov from "@/components/admin/overview/overview.module.css";
import { SearchPanel } from "@/components/admin/overview/SearchPanel";
import { TrendChart } from "@/components/admin/overview/TrendChart";
import { Card, ScrollArea } from "@/components/ui";
import { deviceLabels, sourceLabels, type Device, type TrafficSource } from "@/lib/analytics/traffic";
import { addDays, statDay } from "@/lib/analytics/traffic";
import { agreement } from "@/lib/agent/review";
import { sumAgentApiCalls } from "@/lib/data/agent-api.repo";
import { listAiHandled, listHumanAfterAi } from "@/lib/data/agent.repo";
import { trafficOverview } from "@/lib/data/analytics.repo";
import { getBingPanel, getGscPanel } from "@/lib/data/search-console";
import { fmt } from "@/lib/ui/chart";

export const metadata = { title: "数据总览" };

export default function OverviewPage() {
  return (
    <>
      <AdminTop title="数据总览">
        <span className={ov.sub}>自建统计无 Cookie、匿名；按北京时间自然日统计</span>
      </AdminTop>
      <ScrollArea className={styles.scrollPane} viewportClassName={styles.scrollPaneVp}>
        <Suspense fallback={<Card className={ov.card}><p className={ov.empty}>统计加载中…</p></Card>}>
          <Traffic />
        </Suspense>
        <Suspense fallback={<Pending title="审核 Agent" />}>
          <AiReview />
        </Suspense>
        <Suspense fallback={<Pending title="Agent 接入调用" />}>
          <AgentCalls />
        </Suspense>
        <div className={ov.split}>
          <Suspense fallback={<Pending title="Google 搜索（Search Console）" />}>
            <Gsc />
          </Suspense>
          <Suspense fallback={<Pending title="Bing 搜索（Webmaster Tools）" />}>
            <Bing />
          </Suspense>
        </div>
      </ScrollArea>
    </>
  );
}

function Pending({ title }: { title: string }) {
  return (
    <Card className={ov.card}>
      <h2 className={ov.h2}>{title}</h2>
      <p className={ov.empty}>正在获取…</p>
    </Card>
  );
}

async function Traffic() {
  await connection(); // 统计按请求时刻计算「今天」，不参与预渲染
  const t = await trafficOverview();
  const entries = t.sources.reduce((a, r) => a + r.count, 0);
  return (
    <>
      <dl className={ov.kpis}>
        {(
          [
            ["今日", t.totals.today],
            ["近 7 天", t.totals.d7],
            ["近 30 天", t.totals.d30],
          ] as const
        ).map(([label, v]) => (
          <Card key={label} className={ov.kpi}>
            <dt>{label}</dt>
            <dd>
              <b>{fmt(v.pv)}</b>
              <span>浏览量</span>
            </dd>
            <dd>
              <b className={ov.uvNum}>{fmt(v.uv)}</b>
              <span>访客{label === "今日" ? "" : "（逐日去重之和）"}</span>
            </dd>
          </Card>
        ))}
      </dl>

      <Card className={ov.card}>
        <h2 className={ov.h2}>近 30 天趋势</h2>
        <TrendChart series={t.series} />
      </Card>

      <div className={ov.split}>
        <Card className={ov.card}>
          <h2 className={ov.h2}>热门页面 Top 10<span className={ov.range}>近 30 天</span></h2>
          <Bars rows={t.topPages} mono empty="还没有页面浏览记录" />
        </Card>
        <Card className={ov.card}>
          <h2 className={ov.h2}>进站来源<span className={ov.range}>近 30 天 · 不含站内跳转</span></h2>
          <Bars rows={t.sources.map((r) => ({ ...r, label: sourceLabels[r.key as TrafficSource] ?? r.key }))} empty="还没有进站记录" />
          <h3 className={ov.h3}>搜索引擎进站</h3>
          <dl className={ov.kpis4}>
            <div><dt>Google · 7 天</dt><dd>{fmt(t.search.google7)}</dd></div>
            <div><dt>Google · 30 天</dt><dd>{fmt(t.search.google30)}</dd></div>
            <div><dt>Bing · 7 天</dt><dd>{fmt(t.search.bing7)}</dd></div>
            <div><dt>Bing · 30 天</dt><dd>{fmt(t.search.bing30)}</dd></div>
          </dl>
          <h3 className={ov.h3}>外链 / 社交 / 其他搜索来源域名</h3>
          <Bars rows={t.referrers} mono total={entries} empty="暂无外部来源" />
          <h3 className={ov.h3}>设备</h3>
          <Bars rows={t.devices.map((r) => ({ ...r, label: deviceLabels[r.key as Device] ?? r.key }))} empty="暂无数据" />
        </Card>
      </div>

      <Card className={ov.card}>
        <h2 className={ov.h2}>工具与资源事件<span className={ov.range}>近 30 天</span></h2>
        <dl className={ov.kpis4}>
          <div><dt>资源详情浏览</dt><dd>{fmt(t.events.resource_view)}</dd></div>
          <div><dt>打开工具</dt><dd>{fmt(t.events.tool_open)}</dd></div>
          <div><dt>执行工具</dt><dd>{fmt(t.events.tool_execute)}</dd></div>
          <div><dt>资源 → 工具点击</dt><dd>{fmt(t.events.resource_to_tool_click)}</dd></div>
        </dl>
        {t.tools.length > 0 ? (
          <div className={ov.tblWrap}>
            <table className={ov.tbl}>
              <caption>按工具</caption>
              <thead><tr><th scope="col">工具</th><th scope="col">打开</th><th scope="col">执行</th><th scope="col">从资源跳转</th></tr></thead>
              <tbody>
                {t.tools.map((r) => (
                  <tr key={r.name}><th scope="row">{r.name}</th><td>{fmt(r.open)}</td><td>{fmt(r.execute)}</td><td>{fmt(r.click)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={ov.empty}>还没有工具事件</p>
        )}
      </Card>
    </>
  );
}

const statusText: Record<string, string> = { published: "已发布", drafted: "进草稿", rejected: "已拒绝", pending: "待审核" };
const aiTime = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

/** 审核 Agent：近 7 天自动处理的候选（抽查、撤回）与近 30 天建议模式的一致率（docs/spec/审核Agent方案.md §8）。 */
async function AiReview() {
  await connection();
  const now = new Date();
  const [handled, human] = await Promise.all([listAiHandled(new Date(now.getTime() - 7 * 86_400_000)), listHumanAfterAi(new Date(now.getTime() - 30 * 86_400_000))]);
  const pub = handled.filter((h) => h.status === "published" || h.status === "drafted").length;
  const rej = handled.filter((h) => h.status === "rejected").length;
  const { total, agree } = agreement(human);
  return (
    <Card className={ov.card}>
      <h2 className={ov.h2}>审核 Agent<span className={ov.range}>自动处理近 7 天 · 一致率近 30 天</span></h2>
      <dl className={ov.kpis4}>
        <div><dt>自动上架</dt><dd>{fmt(pub)}</dd></div>
        <div><dt>自动拒绝</dt><dd>{fmt(rej)}</dd></div>
        <div><dt>AI 与人工一致</dt><dd>{total ? `${Math.round((agree / total) * 100)}%` : "—"}</dd></div>
        <div><dt>参与对比</dt><dd>{fmt(total)}</dd></div>
      </dl>
      {handled.length > 0 ? (
        <div className={ov.tblWrap}>
          <table className={ov.tbl}>
            <caption>最近自动处理（点资源可改回草稿）</caption>
            <thead><tr><th scope="col">候选</th><th scope="col">结果</th><th scope="col">分数</th><th scope="col">时间</th></tr></thead>
            <tbody>
              {handled.map((h) => (
                <tr key={h.id}>
                  <th scope="row">{h.resource ? <a href={`/admin/resources/${h.resource.id}`}>{h.name}</a> : h.name}</th>
                  <td>{statusText[h.status] ?? h.status}</td>
                  <td>{h.reviewScore ?? "—"}</td>
                  <td>{h.reviewedAt ? aiTime.format(h.reviewedAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={ov.empty}>近 7 天没有自动处理的候选（建议模式下只给结论，不自动处理）</p>
      )}
    </Card>
  );
}

const AGENT_TOOLS = ["list_categories", "list_tags", "search_resources", "get_resource"] as const;

/** Agent 接入（HTTP API / MCP）近 30 天调用量，按工具 × 通道（docs/spec/Agent接入方案.md §8）。 */
async function AgentCalls() {
  await connection();
  const today = statDay();
  const rows = await sumAgentApiCalls(addDays(today, -29), addDays(today, 1));
  const n = (tool: string, ch: "http" | "mcp") => rows.find((r) => r.tool === tool && r.channel === ch)?.calls ?? 0;
  const sum = (ch: "http" | "mcp") => rows.filter((r) => r.channel === ch).reduce((a, r) => a + r.calls, 0);
  return (
    <Card className={ov.card}>
      <h2 className={ov.h2}>Agent 接入调用<span className={ov.range}>近 30 天 · 不记查询内容</span></h2>
      <dl className={ov.kpis4}>
        <div><dt>合计</dt><dd>{fmt(sum("http") + sum("mcp"))}</dd></div>
        <div><dt>MCP</dt><dd>{fmt(sum("mcp"))}</dd></div>
        <div><dt>HTTP API</dt><dd>{fmt(sum("http"))}</dd></div>
        <div><dt>资源详情</dt><dd>{fmt(n("get_resource", "http") + n("get_resource", "mcp"))}</dd></div>
      </dl>
      {rows.length > 0 ? (
        <div className={ov.tblWrap}>
          <table className={ov.tbl}>
            <caption>按工具</caption>
            <thead><tr><th scope="col">工具</th><th scope="col">MCP</th><th scope="col">HTTP API</th></tr></thead>
            <tbody>
              {AGENT_TOOLS.map((t) => (
                <tr key={t}><th scope="row">{t}</th><td>{fmt(n(t, "mcp"))}</td><td>{fmt(n(t, "http"))}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={ov.empty}>还没有 Agent 调用</p>
      )}
    </Card>
  );
}

async function Gsc() {
  const panel = await getGscPanel();
  return (
    <SearchPanel
      title="Google 搜索（Search Console）"
      panel={panel}
      note="近 28 天（太平洋时间），数据每 6 小时刷新；最近 2–3 天的数据可能仍在变化。"
      setup={
        <>
          在 Vercel 配置 <code>GSC_SITE_URL</code> 与 <code>GSC_SERVICE_ACCOUNT_JSON</code>（或 <code>GSC_CLIENT_EMAIL</code> +{" "}
          <code>GSC_PRIVATE_KEY</code>），并在 Search Console 里把服务账号邮箱加为该资源的用户。
        </>
      }
    />
  );
}

async function Bing() {
  const panel = await getBingPanel();
  return (
    <SearchPanel
      title="Bing 搜索（Webmaster Tools）"
      panel={panel}
      note="近 28 天；Bing 的查询词 / 页面统计按周更新，每 6 小时刷新一次。"
      setup={
        <>
          在 Vercel 配置 <code>BING_SITE_URL</code> 与 <code>BING_WEBMASTER_API_KEY</code>（Bing Webmaster → 设置 → API 访问 → API 密钥）。
        </>
      }
    />
  );
}
