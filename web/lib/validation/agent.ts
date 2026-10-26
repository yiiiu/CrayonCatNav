import { z } from "zod";

/** 采集 Agent 设置表单。密钥字段留空表示不修改；勾选 clear* 表示清除已存值。 */

const httpUrl = z
  .string()
  .trim()
  .max(300, "地址过长")
  .refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "请填写 http(s):// 开头的地址");

const secret = z.string().trim().max(500, "密钥过长").default("");

export const agentSettingsSchema = z.object({
  baseUrl: httpUrl.default(""),
  model: z.string().trim().max(100, "模型名过长").default(""),
  apiKey: secret,
  maxPerRun: z.coerce.number().int("请填写整数").min(1, "至少 1 条").max(20, "单次最多 20 条（防止函数超时）").default(8),
  cronEnabled: z.boolean().default(false),
  srcMcpRegistry: z.boolean().default(false),
  srcGithub: z.boolean().default(false),
  srcAwesome: z.boolean().default(false),
  srcHuggingface: z.boolean().default(false),
  srcProductHunt: z.boolean().default(false),
  githubToken: secret,
  clearGithubToken: z.boolean().default(false),
  phToken: secret,
  clearPhToken: z.boolean().default(false),
});

export type AgentSettingsInput = z.infer<typeof agentSettingsSchema>;

export const sourceFields = ["srcMcpRegistry", "srcGithub", "srcAwesome", "srcHuggingface", "srcProductHunt"] as const;

export function agentSettingsFromForm(fd: FormData) {
  const str = (k: string) => (fd.get(k) ?? "").toString();
  const on = (k: string) => fd.get(k) === "on";
  return {
    baseUrl: str("baseUrl"),
    model: str("model"),
    apiKey: str("apiKey"),
    maxPerRun: str("maxPerRun") || "8",
    cronEnabled: on("cronEnabled"),
    srcMcpRegistry: on("srcMcpRegistry"),
    srcGithub: on("srcGithub"),
    srcAwesome: on("srcAwesome"),
    srcHuggingface: on("srcHuggingface"),
    srcProductHunt: on("srcProductHunt"),
    githubToken: str("githubToken"),
    clearGithubToken: on("clearGithubToken"),
    phToken: str("phToken"),
    clearPhToken: on("clearPhToken"),
  };
}

/** 贴链接让 Agent 整理：只收 http(s)。 */
export const collectLinkSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "请粘贴一个链接")
    .max(500, "链接过长")
    .refine((v) => /^https?:\/\//i.test(v), "只支持 http:// 或 https:// 链接"),
});
