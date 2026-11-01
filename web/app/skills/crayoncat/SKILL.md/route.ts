import { skillMarkdown } from "@/lib/agent-api/skill";
import { siteConfig } from "@/lib/site";

/** GET /skills/crayoncat/SKILL.md：下载蜡笔猫 Agent Skill。 */
export function GET() {
  return new Response(skillMarkdown(siteConfig.url.replace(/\/$/, "")), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
