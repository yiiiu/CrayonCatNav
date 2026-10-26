import { z } from "zod";

/**
 * 分类采集配置（按分类定向采集，见架构 §9）：存 CategoryCollectConfig.config（Json），写入与读取都经过本 schema。
 * 纯数据 + zod，前后端与种子脚本共用。
 */

export const collectSourceKeys = ["github", "mcpRegistry", "awesome", "huggingface", "productHunt"] as const;
export type CollectSourceKey = (typeof collectSourceKeys)[number];

export const collectSourceLabels: Record<CollectSourceKey, string> = {
  github: "GitHub 搜索",
  mcpRegistry: "MCP 官方 Registry",
  awesome: "awesome-mcp-servers",
  huggingface: "Hugging Face Spaces",
  productHunt: "Product Hunt",
};

/** 各来源适合的分类说明（表单提示用）。 */
export const collectSourceHints: Record<CollectSourceKey, string> = {
  github: "按本分类的主题 / 关键词搜索，带 star 与活跃度门槛",
  mcpRegistry: "只有 MCP 服务，只适合 MCP 类分类",
  awesome: "只有 MCP 服务，只适合 MCP 类分类",
  huggingface: "按搜索词匹配 Space 名称，按点赞排序；适合创作、模型类",
  productHunt: "近 7 天 AI 话题高票产品，需要 Token",
};

/** 单次采集最多发的 GitHub 搜索请求数（无 token 时搜索接口限 10 次/分钟）。 */
export const MAX_GITHUB_QUERIES = 8;

const uniq = (list: string[]) => [...new Set(list)];

const topic = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{0,49}$/, "GitHub 主题只能是小写字母、数字和连字符（≤50 字）");

const keyword = z
  .string()
  .trim()
  .min(2, "关键词至少 2 个字符")
  .max(40, "关键词最多 40 个字符")
  .regex(/^[\p{L}\p{N} .+#-]+$/u, "关键词只能包含文字、数字、空格和 . + # -");

const hfTerm = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9._-]{2,40}$/, "HF 搜索词只能是 2–40 位字母、数字和 . _ -（匹配 Space 名称）");

const stars = (def: number) => z.coerce.number().int("请填写整数").min(0, "不能小于 0").max(1_000_000, "数值过大").default(def);

export const collectConfigSchema = z
  .object({
    /** 关闭后该分类不参与自动采集，手动也不能选 */
    enabled: z.boolean().default(true),
    sources: z
      .object({
        github: z.boolean().default(false),
        mcpRegistry: z.boolean().default(false),
        awesome: z.boolean().default(false),
        huggingface: z.boolean().default(false),
        productHunt: z.boolean().default(false),
      })
      .default({ github: false, mcpRegistry: false, awesome: false, huggingface: false, productHunt: false }),
    githubTopics: z.array(topic).max(8, "GitHub 主题最多 8 个").default([]).transform(uniq),
    githubKeywords: z.array(keyword).max(4, "GitHub 关键词最多 4 个").default([]).transform(uniq),
    /** 「近期活跃的热门」查询的 star 门槛 */
    githubMinStars: stars(500),
    /** 「近半年新起的」查询的 star 门槛 */
    githubNewMinStars: stars(100),
    /** HF Spaces 搜索词（API 的 search 参数，匹配 Space 名称）；为空时取全站点赞最高 */
    hfSearch: z.array(hfTerm).max(6, "HF 搜索词最多 6 个").default([]).transform(uniq),
    /** 给模型的分类说明：帮助判断条目是否属于该分类 */
    description: z.string().trim().max(500, "分类说明最多 500 字").default(""),
  })
  .superRefine((v, ctx) => {
    if (v.sources.github && v.githubTopics.length + v.githubKeywords.length === 0) {
      ctx.addIssue({ code: "custom", path: ["githubTopics"], message: "开启 GitHub 时至少填一个主题或关键词" });
    }
    if (v.enabled && !collectSourceKeys.some((k) => v.sources[k])) {
      ctx.addIssue({ code: "custom", path: ["sources"], message: "参与采集时至少开启一个来源" });
    }
  });

export type CollectConfig = z.infer<typeof collectConfigSchema>;

/** 读取库里的 Json：不合法返回 null（视为未配置，页面会提示重新保存）。 */
export function parseStoredConfig(json: unknown): CollectConfig | null {
  const r = collectConfigSchema.safeParse(json);
  return r.success ? r.data : null;
}

/** 表单 → 原始对象（交给 schema 校验）。主题与 HF 搜索词按逗号/空白分隔，关键词按逗号/换行分隔（可含空格）。 */
export function collectConfigFromForm(fd: FormData) {
  const str = (k: string) => (fd.get(k) ?? "").toString();
  const on = (k: string) => fd.get(k) === "on";
  const words = (k: string) => str(k).split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean);
  const phrases = (k: string) => str(k).split(/[,，、\n]+/).map((s) => s.trim()).filter(Boolean);
  return {
    enabled: on("enabled"),
    sources: Object.fromEntries(collectSourceKeys.map((k) => [k, on(`src_${k}`)])),
    githubTopics: words("githubTopics"),
    githubKeywords: phrases("githubKeywords"),
    githubMinStars: str("githubMinStars") || "500",
    githubNewMinStars: str("githubNewMinStars") || "100",
    hfSearch: words("hfSearch"),
    description: str("description"),
  };
}

const src = (...on: CollectSourceKey[]) => Object.fromEntries(collectSourceKeys.map((k) => [k, on.includes(k)])) as CollectConfig["sources"];

/**
 * 初始分类的默认采集配置（GitHub 主题均已核实存在且有 ≥100 star 的仓库，新 5 类核实于 2026-10-26）。
 * 只由 prisma/seed.ts 在该分类还没有配置时写入，后台改过的不覆盖。
 */
export const DEFAULT_COLLECT_CONFIGS: Record<string, CollectConfig> = {
  "ai-coding": {
    enabled: true,
    sources: src("github", "productHunt"),
    githubTopics: ["coding-agent", "ai-coding", "code-generation", "coding-assistant"],
    githubKeywords: ["ai code review", "ai code editor"],
    githubMinStars: 500,
    githubNewMinStars: 100,
    hfSearch: [],
    description: "帮人写代码、改代码、审代码、调试或生成应用的 AI 工具：AI 编辑器/IDE 插件、命令行编程 Agent、代码补全与代码审查、一句话生成应用等。纯 MCP 服务归「MCP 服务」，模型本身归「AI 模型/API」。",
  },
  mcp: {
    enabled: true,
    sources: src("mcpRegistry", "awesome", "github"),
    githubTopics: ["mcp-server", "model-context-protocol"],
    githubKeywords: ["mcp server"],
    githubMinStars: 500,
    githubNewMinStars: 100,
    hfSearch: [],
    description: "实现 Model Context Protocol（MCP）的服务端、客户端、网关、注册表与开发框架，让 AI 应用连接外部工具和数据。只是「支持 MCP」的普通应用不算。",
  },
  "agent-skills": {
    enabled: true,
    sources: src("github"),
    githubTopics: ["agent-skills", "claude-skills", "ai-agents"],
    githubKeywords: ["agent skills"],
    githubMinStars: 500,
    githubNewMinStars: 100,
    hfSearch: [],
    description: "给 AI Agent 增加能力的技能包、提示词/工作流集合（如 Claude Skills、SKILL.md 规范）与现成可用的 Agent 应用。用来构建 Agent 的框架与 SDK 归「Agent 框架」。",
  },
  "models-api": {
    enabled: true,
    sources: src("github", "huggingface", "productHunt"),
    githubTopics: ["llm-inference", "openai-api", "large-language-models", "llm-serving"],
    githubKeywords: ["llm gateway"],
    githubMinStars: 500,
    githubNewMinStars: 100,
    hfSearch: ["chat", "llm", "qwen"],
    description: "大语言模型与多模态模型本身、模型 API 平台与聚合网关、云端推理服务、开源模型的在线体验。本地运行工具与推理引擎归「本地模型与推理」，基于模型做出的具体应用归对应的应用分类。",
  },
  "github-oss": {
    enabled: true,
    sources: src("github"),
    githubTopics: ["llm", "generative-ai", "ai-tools", "self-hosted"],
    githubKeywords: [],
    githubMinStars: 1000,
    githubNewMinStars: 200,
    hfSearch: [],
    description: "以 GitHub 仓库为主、可自部署的热门 AI 开源项目，作为其他分类之外的兜底：LLM 应用、AI 基础设施等。与 AI 无关的通用自托管项目不收；明显属于编程、MCP、创作、UI 组件、Agent 框架、本地推理、RAG、评测等具体分类的优先归那边。",
  },
  "ai-creation": {
    enabled: true,
    sources: src("github", "huggingface", "productHunt"),
    githubTopics: ["stable-diffusion", "text-to-image", "text-to-video", "text-to-speech", "music-generation"],
    githubKeywords: [],
    githubMinStars: 500,
    githubNewMinStars: 100,
    hfSearch: ["image", "video", "music", "tts", "flux"],
    description: "生成或编辑图片、视频、音乐、语音、3D 等内容的 AI 工具与开源项目，以及写作、设计类创作工具。",
  },
  "ui-components": {
    enabled: true,
    sources: src("github", "productHunt"),
    githubTopics: ["shadcn-ui", "react-components", "component-library", "design-system", "ui-library", "generative-ui"],
    githubKeywords: ["ai chat ui", "agent ui"],
    githubMinStars: 500,
    githubNewMinStars: 100,
    hfSearch: [],
    description: "前端 UI 组件库与设计系统（React/Vue/Web Components、Tailwind 组件），AI 对话界面、Agent 交互界面组件与生成式 UI 工具。只是用了某个组件库的普通应用不算；一句话生成整站的工具归「AI 编程」。",
  },
  "agent-frameworks": {
    enabled: true,
    sources: src("github"),
    githubTopics: ["agent-framework", "multi-agent", "llm-agent", "autonomous-agents", "agentic-ai"],
    githubKeywords: ["agent sdk"],
    githubMinStars: 500,
    githubNewMinStars: 100,
    hfSearch: [],
    description: "用来构建 AI Agent 的开发框架与 SDK：单/多 Agent 编排、工具调用、记忆与状态管理、Agent 工作流引擎。现成的技能包与 Agent 应用归「Agent Skills」，MCP 服务归「MCP 服务」。",
  },
  "local-llm": {
    enabled: true,
    sources: src("github"),
    githubTopics: ["local-llm", "ollama", "llamacpp", "quantization", "gguf", "edge-ai"],
    githubKeywords: ["local llm"],
    githubMinStars: 500,
    githubNewMinStars: 100,
    hfSearch: [],
    description: "在本地或自有硬件上运行大模型的工具：本地运行器与桌面客户端、推理引擎、模型量化与格式转换、端侧/边缘部署。云端 API 平台归「AI 模型/API」。",
  },
  "rag-knowledge": {
    enabled: true,
    sources: src("github"),
    githubTopics: ["rag", "retrieval-augmented-generation", "vector-database", "knowledge-base"],
    githubKeywords: ["document parsing"],
    githubMinStars: 500,
    githubNewMinStars: 100,
    hfSearch: [],
    description: "检索增强生成（RAG）框架、向量数据库、Embedding 与重排工具、文档解析与切分、AI 知识库与企业搜索。通用数据库或与 AI 无关的笔记软件不算。",
  },
  llmops: {
    enabled: true,
    sources: src("github"),
    githubTopics: ["llmops", "llm-evaluation", "llm-observability", "prompt-engineering", "evals"],
    githubKeywords: ["llm tracing"],
    githubMinStars: 500,
    githubNewMinStars: 100,
    hfSearch: [],
    description: "LLM 应用的工程化工具：评测与基准、调用追踪与可观测、Prompt 管理与版本、成本监控、红队与安全测试。单纯的提示词合集归「Agent Skills」。",
  },
};
