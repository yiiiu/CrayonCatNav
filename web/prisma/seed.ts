/**
 * 种子脚本（每次部署都会执行，只补缺、不覆盖后台改动）：
 * 1. 初始 6 大分类：只创建缺失的，已有分类的名称和排序归后台管理；
 *    同时为这 6 个分类补默认采集配置（lib/validation/collect-config.ts），只在该分类还没有配置时写入，后台改过的不覆盖
 * 2. 工具表同步：名称与描述以代码注册表 metas.ts 为准；状态与排序归后台
 * 3. 修复旧版 URL 编码的标签 slug
 * 4. 首批 36 条资源（含标签与 ResourceTool 关联）：仅在资源表为空时初始化一次
 * 5. 按环境变量创建首个管理员（已存在则不改）
 *
 * 运行：pnpm db:seed
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient, type PricingType } from "../generated/prisma/client";
import { toolMetas } from "../lib/tools/metas";
import { DEFAULT_COLLECT_CONFIGS } from "../lib/validation/collect-config";
import { tagSlugFor } from "./tag-slugs";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const categories = [
  { slug: "ai-coding", name: "AI 编程" },
  { slug: "mcp", name: "MCP 服务" },
  { slug: "agent-skills", name: "Agent Skills" },
  { slug: "models-api", name: "AI 模型/API" },
  { slug: "github-oss", name: "GitHub 开源项目" },
  { slug: "ai-creation", name: "AI 创作" },
];

type SeedItem = {
  slug: string;
  name: string;
  summary: string;
  description: string;
  categorySlug: string;
  websiteUrl?: string;
  githubUrl?: string;
  pricingType: PricingType;
  tags: string[];
  toolSlugs?: string[];
  featuredOrder?: number;
};

const SEED_RESOURCES: SeedItem[] = [
  // 1. AI 编程
  {
    slug: "cursor",
    name: "Cursor",
    summary: "基于 VS Code 深度定制的 AI-first 代码编辑器，支持多文件协同编辑。",
    description: "Cursor 是目前最流行的 AI 原生代码编辑器之一，集成了代码预测补全、终端自动化、Composer 多文件协作与语义代码库问答功能。",
    categorySlug: "ai-coding",
    websiteUrl: "https://www.cursor.com",
    pricingType: "freemium",
    tags: ["编辑器", "智能补全", "Agent"],
    featuredOrder: 1,
  },
  {
    slug: "claude-code",
    name: "Claude Code",
    summary: "Anthropic 推出的终端 Agent 编程工具，可自主读写代码并执行测试。",
    description: "Claude Code 是一款运行在命令行终端中的交互式编码 Agent，支持读取本地文件目录、自动化执行测试与 Git 提交。",
    categorySlug: "ai-coding",
    websiteUrl: "https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview",
    githubUrl: "https://github.com/anthropics/claude-code",
    pricingType: "paid",
    tags: ["CLI", "终端", "Agent"],
    featuredOrder: 2,
  },
  {
    slug: "github-copilot",
    name: "GitHub Copilot",
    summary: "GitHub 与 OpenAI 合作的 AI 结对编程助手，支持主流 IDE。",
    description: "支持实时单行与多行代码自动补全、单元测试生成与代码解释，深度集成于 VS Code 与 JetBrains 系列编辑器。",
    categorySlug: "ai-coding",
    websiteUrl: "https://github.com/features/copilot",
    pricingType: "paid",
    tags: ["代码补全", "IDE插件"],
  },
  {
    slug: "v0-vercel",
    name: "v0 by Vercel",
    summary: "通过自然语言提示生成现代 React/Tailwind 前端 UI 界面。",
    description: "Vercel 推出的 Generative UI 工具，基于 shadcn/ui 和 Tailwind CSS，支持一键在浏览器中交互预览并复制代码。",
    categorySlug: "ai-coding",
    websiteUrl: "https://v0.dev",
    pricingType: "freemium",
    tags: ["前端生成", "React", "Tailwind"],
  },
  {
    slug: "bolt-new",
    name: "Bolt.new",
    summary: "StackBlitz 推出的浏览器全栈 AI 开发沙盒，可实时安装 npm 并部署。",
    description: "基于 WebContainers 架构，允许用户直接在浏览器中构建、运行与调试完整的全栈 Node.js/Vite 应用并一键发布。",
    categorySlug: "ai-coding",
    websiteUrl: "https://bolt.new",
    pricingType: "freemium",
    tags: ["在线开发", "全栈", "沙盒"],
  },
  {
    slug: "windsurf",
    name: "Windsurf",
    summary: "Codeium 打造的具备 Cascade 实时感知流的 Agentic 编程编辑器。",
    description: "提供深度上下文感知的 Cascade 系统，将协同补全与端到端 Agent 任务流融为一体。",
    categorySlug: "ai-coding",
    websiteUrl: "https://codeium.com/windsurf",
    pricingType: "freemium",
    tags: ["编辑器", "Cascade", "代码审查"],
  },

  // 2. MCP 服务 (重点关联 mcp-config)
  {
    slug: "mcp-filesystem",
    name: "Filesystem MCP",
    summary: "官方本地文件系统读写服务，支持指定安全沙盒目录。",
    description: "Model Context Protocol 官方提供的标准本地文件服务，允许模型在授权目录下安全读取、创建和更新文件。",
    categorySlug: "mcp",
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    pricingType: "free",
    tags: ["官方服务", "文件管理", "MCP"],
    toolSlugs: ["mcp-config"],
    featuredOrder: 3,
  },
  {
    slug: "mcp-github",
    name: "GitHub MCP",
    summary: "提供 GitHub 仓库搜索、Issue 与 PR 读写的官方 MCP 服务。",
    description: "官方提供的 GitHub 交互服务，允许模型直接检索仓库文件、阅读代码分支并处理 Pull Request 与 Issue。",
    categorySlug: "mcp",
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    pricingType: "free",
    tags: ["GitHub", "Git", "MCP"],
    toolSlugs: ["mcp-config"],
  },
  {
    slug: "mcp-postgres",
    name: "PostgreSQL MCP",
    summary: "提供 PostgreSQL 数据库 schema 检查与只读/查询能力的 MCP 服务。",
    description: "允许 AI 模型安全连接 PostgreSQL 数据库，检查表结构、外键关系并执行只读 SQL 查询以辅助业务排查。",
    categorySlug: "mcp",
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    pricingType: "free",
    tags: ["数据库", "Postgres", "MCP"],
    toolSlugs: ["mcp-config"],
  },
  {
    slug: "mcp-brave-search",
    name: "Brave Search MCP",
    summary: "利用 Brave 搜索 API 为 AI 赋予联网实时检索能力的 MCP 服务。",
    description: "通过 Brave Search API 实现网络信息抓取与网页搜索，为模型提供具备时效性的实时外部知识查询能力。",
    categorySlug: "mcp",
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    pricingType: "free",
    tags: ["搜索", "联网检索", "MCP"],
    toolSlugs: ["mcp-config"],
  },
  {
    slug: "mcp-fetch",
    name: "Fetch MCP",
    summary: "获取指定 URL 内容并高效转换为干净 Markdown 文本的 MCP 服务。",
    description: "轻量高效的网页正文提取与 HTML 转 Markdown 服务，方便模型快速摄取外部文档与网页内容。",
    categorySlug: "mcp",
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    pricingType: "free",
    tags: ["正文提取", "网页转换", "MCP"],
    toolSlugs: ["mcp-config"],
  },
  {
    slug: "mcp-memory",
    name: "Memory MCP",
    summary: "基于知识图谱的本地持久化记忆管理服务，跨会话记忆实体关系。",
    description: "官方提供的基于知识图谱（Knowledge Graph）的持久化记忆服务，帮助 Agent 在不同会话间维持连贯的上下文认知。",
    categorySlug: "mcp",
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    pricingType: "free",
    tags: ["记忆管理", "知识图谱", "MCP"],
    toolSlugs: ["mcp-config"],
  },
  {
    slug: "mcp-puppeteer",
    name: "Puppeteer MCP",
    summary: "基于无头浏览器的网页自动化导航、控制台日志与页面截图服务。",
    description: "利用 Puppeteer 无头浏览器提供网页导航、点击交互、控制台错误日志采集和页面快照截图功能。",
    categorySlug: "mcp",
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    pricingType: "free",
    tags: ["自动化", "浏览器", "MCP"],
    toolSlugs: ["mcp-config"],
  },

  // 3. Agent Skills & 平台
  {
    slug: "dify",
    name: "Dify",
    summary: "开源的大语言模型应用开发平台，支持编排 Agent 工作流与 RAG 知识库。",
    description: "一站式可视化 LLM 应用编排平台，提供从 Prompt 工程、工作流编排到知识库构建与模型微调的全链路支持。",
    categorySlug: "agent-skills",
    websiteUrl: "https://dify.ai",
    githubUrl: "https://github.com/langgenius/dify",
    pricingType: "freemium",
    tags: ["开源平台", "工作流", "RAG"],
    featuredOrder: 4,
  },
  {
    slug: "coze",
    name: "Coze (扣子)",
    summary: "字节跳动旗下的一站式 AI Bot 与 Agent 开发编排平台。",
    description: "提供海量插件与工作流模板，无论是初学者还是开发者都可以快速搭建特定领域的专属智能体并部署多端。",
    categorySlug: "agent-skills",
    websiteUrl: "https://www.coze.cn",
    pricingType: "freemium",
    tags: ["Bot平台", "多智能体", "插件系统"],
  },
  {
    slug: "crewai",
    name: "CrewAI",
    summary: "强调角色扮演与自主协作的多智能体编排 Python 框架。",
    description: "基于角色驱动的多智能体协作框架，让多个具身 Agent 分工协作完成复杂的研究、撰写与工程任务。",
    categorySlug: "agent-skills",
    websiteUrl: "https://www.crewai.com",
    githubUrl: "https://github.com/crewAIInc/crewAI",
    pricingType: "free",
    tags: ["多智能体", "Python", "任务编排"],
  },
  {
    slug: "autogpt",
    name: "AutoGPT",
    summary: "经典的开源自主执行智能体，支持复杂多步目标的分解与自动化达成。",
    description: "开源自主智能体领域的奠基项目之一，演示了语言模型通过持续反思、拆解目标与调用工具达成复杂使命。",
    categorySlug: "agent-skills",
    githubUrl: "https://github.com/Significant-Gravitas/AutoGPT",
    pricingType: "free",
    tags: ["自主智能体", "自动化"],
  },
  {
    slug: "claude-computer-use",
    name: "Claude Computer Use",
    summary: "Anthropic 提供的使 Claude 能够模拟鼠标键盘操作计算机屏幕的能力。",
    description: "通过屏幕视线识别、鼠标移动、点击与文本输入，实现与人类桌面完全一致的图形用户界面操作交互。",
    categorySlug: "agent-skills",
    githubUrl: "https://github.com/anthropics/anthropic-quickstarts",
    pricingType: "free",
    tags: ["GUI操作", "多模态", "Agent"],
  },
  {
    slug: "langgraph",
    name: "LangGraph",
    summary: "构建具备循环状态与多 Agent 协同的高可控图编排框架。",
    description: "LangChain 推出的图结构流程框架，专门解决复杂 Agent 任务中的循环循环决策、状态持久化与人机协同介入。",
    categorySlug: "agent-skills",
    websiteUrl: "https://langchain-ai.github.io/langgraph",
    githubUrl: "https://github.com/langchain-ai/langgraph",
    pricingType: "free",
    tags: ["状态机", "流程编排", "LangChain"],
  },

  // 4. AI 模型/API (重点关联 token-cost)
  {
    slug: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    summary: "Anthropic 旗舰模型，在代码生成、长文本推理与多模态处于顶尖水平。",
    description: "目前代码编写与高阶逻辑推理的标杆模型，输入单价每百万 Token $3，输出单价每百万 Token $15。",
    categorySlug: "models-api",
    websiteUrl: "https://www.anthropic.com/claude",
    pricingType: "paid",
    tags: ["Anthropic", "旗舰模型", "编程标杆"],
    toolSlugs: ["token-cost"],
  },
  {
    slug: "gpt-4o",
    name: "OpenAI GPT-4o",
    summary: "OpenAI 旗舰多模态模型，支持文本、语音、视觉端到端高速处理。",
    description: "全方位多模态全能大模型，输入单价每百万 Token $2.5，输出单价每百万 Token $10。",
    categorySlug: "models-api",
    websiteUrl: "https://openai.com/index/hello-gpt-4o",
    pricingType: "paid",
    tags: ["OpenAI", "多模态", "高速API"],
    toolSlugs: ["token-cost"],
  },
  {
    slug: "deepseek-r1",
    name: "DeepSeek-R1",
    summary: "深度求索开源的高性能强化学习推理模型，兼具顶尖代码与数学能力。",
    description: "通过大规模强化学习训练的开源前沿思考推理模型，API 极具性价比（输入约 ¥0.55/M Token，输出约 ¥2.19/M Token）。",
    categorySlug: "models-api",
    websiteUrl: "https://chat.deepseek.com",
    githubUrl: "https://github.com/deepseek-ai/DeepSeek-R1",
    pricingType: "freemium",
    tags: ["开源模型", "深度推理", "性价比"],
    toolSlugs: ["token-cost"],
    featuredOrder: 5,
  },
  {
    slug: "gemini-1-5-pro",
    name: "Gemini 1.5 Pro",
    summary: "谷歌长上下文多模态旗舰，支持高达 200 万 Token 的上下文窗口。",
    description: "突破性的超长上下文多模态模型，能够同时分析数小时视频、百万行代码库或海量文档。",
    categorySlug: "models-api",
    websiteUrl: "https://deepmind.google/technologies/gemini/pro",
    pricingType: "freemium",
    tags: ["Google", "百万上下文", "多模态"],
    toolSlugs: ["token-cost"],
  },
  {
    slug: "ollama",
    name: "Ollama",
    summary: "本地轻量运行大语言模型的极简工具，支持 Llama、Qwen、DeepSeek 等。",
    description: "一行命令在本地下载、启动并提供兼容 OpenAI API 的大模型服务，极大降低了本地化 AI 应用开发门槛。",
    categorySlug: "models-api",
    websiteUrl: "https://ollama.com",
    githubUrl: "https://github.com/ollama/ollama",
    pricingType: "free",
    tags: ["本地运行", "开源", "CLI"],
  },
  {
    slug: "groq",
    name: "Groq",
    summary: "基于自研 LPU 架构的超高速模型推理服务，实现数百 Token/s 的响应。",
    description: "基于专用芯片的极速推理云，为开源模型提供超低延迟的 API 访问，适合高实时性对话与复杂 Agent 系统。",
    categorySlug: "models-api",
    websiteUrl: "https://groq.com",
    pricingType: "freemium",
    tags: ["极速推理", "LPU", "API"],
  },

  // 5. GitHub 开源项目
  {
    slug: "open-webui",
    name: "Open WebUI",
    summary: "功能强大、完全可离线自托管的 ChatGPT 风格 Web 用户界面。",
    description: "支持本地与云端模型聚合接入的自托管 Web 客户端，内置 RAG 文档检索、代码运行沙盒与多用户权限管理。",
    categorySlug: "github-oss",
    websiteUrl: "https://openwebui.com",
    githubUrl: "https://github.com/open-webui/open-webui",
    pricingType: "free",
    tags: ["Web界面", "自托管", "Ollama"],
    featuredOrder: 6,
  },
  {
    slug: "chatbox",
    name: "Chatbox",
    summary: "简洁易用的跨平台开源桌面 AI 客户端，支持多模型 API 聚合配置。",
    description: "开源且尊重隐私的本地桌面应用，支持 Windows、macOS 和 Linux，让用户自由使用自己的 API Key 与各家模型交互。",
    categorySlug: "github-oss",
    websiteUrl: "https://chatboxai.app",
    githubUrl: "https://github.com/chatbox-ai/chatbox",
    pricingType: "freemium",
    tags: ["桌面客户端", "跨平台", "本地私有"],
  },
  {
    slug: "vllm",
    name: "vLLM",
    summary: "高吞吐量、低延迟的 LLM 推理和服务引擎，采用 PagedAttention 技术。",
    description: "伯克利开源的高性能大模型服务引擎，通过显存高效分页管理大幅降低碎片化，是目前业界标准推理部署方案。",
    categorySlug: "github-oss",
    websiteUrl: "https://vllm.ai",
    githubUrl: "https://github.com/vllm-project/vllm",
    pricingType: "free",
    tags: ["推理加速", "生产部署", "高并发"],
  },
  {
    slug: "llamaindex",
    name: "LlamaIndex",
    summary: "专为大模型应用量身打造的数据检索增强（RAG）与知识索引框架。",
    description: "连接私有业务数据与语言模型的数据框架，提供从数据接入、解析、向量嵌入到结构化检索的全套工具。",
    categorySlug: "github-oss",
    websiteUrl: "https://www.llamaindex.ai",
    githubUrl: "https://github.com/run-llama/llama_index",
    pricingType: "free",
    tags: ["RAG", "知识库", "数据框架"],
  },
  {
    slug: "langchain",
    name: "LangChain",
    summary: "广泛应用的 LLM 应用开发上下文感知与工具链编排框架。",
    description: "大语言模型工程化开发的通用胶水层，支持模型抽象、记忆保持、提示模板与向量搜索工具链。",
    categorySlug: "github-oss",
    websiteUrl: "https://www.langchain.com",
    githubUrl: "https://github.com/langchain-ai/langchain",
    pricingType: "free",
    tags: ["应用开发", "生态", "中间件"],
  },
  {
    slug: "fastchat",
    name: "FastChat",
    summary: "训练、服务和评估大语言模型聊天机器人的开放平台。",
    description: "由 LMSYS 团队开发，支撑了著名的大模型竞技场（Chatbot Arena），包含完备的微调、分布式评测与 Web 演示流程。",
    categorySlug: "github-oss",
    githubUrl: "https://github.com/lm-sys/FastChat",
    pricingType: "free",
    tags: ["模型评测", "竞技场", "微调"],
  },

  // 6. AI 创作
  {
    slug: "midjourney",
    name: "Midjourney",
    summary: "行业标杆级 AI 艺术图像生成服务，拥有卓越的美学表现力。",
    description: "领先的生成式 AI 图像平台，以独特的艺术审美构图、写实质感与强烈的风格化表达著称。",
    categorySlug: "ai-creation",
    websiteUrl: "https://www.midjourney.com",
    pricingType: "paid",
    tags: ["图像生成", "艺术设计", "商业插画"],
  },
  {
    slug: "flux-1",
    name: "Flux.1",
    summary: "Black Forest Labs 开源的尖端文生图模型，解剖结构与文本渲染能力强。",
    description: "Stable Diffusion 核心原班团队打造的 120 亿参数文生图模型，在手指细节、复杂光影与英文字符渲染上极具突破。",
    categorySlug: "ai-creation",
    githubUrl: "https://github.com/black-forest-labs/flux",
    pricingType: "free",
    tags: ["开源生图", "提示词控制", "照片级"],
  },
  {
    slug: "suno",
    name: "Suno",
    summary: "颠覆性的 AI 音乐创作平台，输入歌词或风格即可生成高品质完整歌曲。",
    description: "仅需一段提示词或歌词，即可创作出包含丰富人声演唱、器乐编排与高品质混音的完整音乐单曲。",
    categorySlug: "ai-creation",
    websiteUrl: "https://suno.com",
    pricingType: "freemium",
    tags: ["音乐生成", "歌词编曲", "AI音频"],
  },
  {
    slug: "runway-gen3",
    name: "Runway Gen-3 Alpha",
    summary: "领先的多模态 AI 视频生成平台，支持高保真运镜与精细运动控制。",
    description: "新一代超逼真视频生成工具，支持文本生视频、图像生视频与精准的相机运动控制，服务于专业影视创意工作流。",
    categorySlug: "ai-creation",
    websiteUrl: "https://runwayml.com",
    pricingType: "paid",
    tags: ["视频生成", "运镜控制", "影视后期"],
  },
  {
    slug: "krea-ai",
    name: "Krea AI",
    summary: "实时交互式 AI 画布与画质增强工具，支持边画草图边实时出图。",
    description: "毫秒级实时重绘引擎，允许设计师在左侧涂鸦或放置几何形状，右侧毫秒级渲染出高保真精细概念图。",
    categorySlug: "ai-creation",
    websiteUrl: "https://www.krea.ai",
    pricingType: "freemium",
    tags: ["实时绘图", "超分辨率", "设计辅助"],
  },
];

async function main() {
  // 每次部署（vercel-build）都会跑种子，所以这里只「补缺」，绝不覆盖后台改过的内容：
  // 分类只建缺失的；资源只在空库时初始化；标签只修复旧版 URL 编码的 slug。
  console.log("1. 补齐分类（已存在的不改名称和排序）...");
  const categoryMap = new Map<string, string>();
  for (const [i, c] of categories.entries()) {
    const saved = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c, sortOrder: i },
    });
    categoryMap.set(c.slug, saved.id);
  }

  console.log("1b. 补齐分类采集配置（只补没有配置的分类）...");
  for (const [slug, config] of Object.entries(DEFAULT_COLLECT_CONFIGS)) {
    const categoryId = categoryMap.get(slug);
    if (!categoryId) continue;
    await prisma.categoryCollectConfig.upsert({ where: { categoryId }, update: {}, create: { categoryId, config } });
  }

  console.log("2. 同步工具注册表（名称与描述以代码为准，状态和排序归后台）...");
  const toolMap = new Map<string, string>();
  for (const t of toolMetas) {
    const saved = await prisma.tool.upsert({
      where: { slug: t.slug },
      update: { name: t.name, description: t.description },
      create: { slug: t.slug, name: t.name, description: t.description, status: t.defaultStatus, sortOrder: t.sortOrder },
    });
    toolMap.set(t.slug, saved.id);
  }

  console.log("3. 修复旧版 URL 编码的标签 slug...");
  await repairEncodedTagSlugs();

  const existing = await prisma.resource.count();
  if (existing > 0) {
    console.log(`4. 资源库已有 ${existing} 条，跳过首批资源（后台的编辑、下架、删除和精选顺序都保留）。`);
  } else {
    console.log(`4. 空库初始化：录入首批 ${SEED_RESOURCES.length} 条资源与标签/关联工具...`);
    await seedResources(categoryMap, toolMap);
  }

  console.log("5. 检查首个管理员...");
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 12) throw new Error("SEED_ADMIN_PASSWORD 至少 12 位");
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.admin.upsert({ where: { email }, update: {}, create: { email, passwordHash, role: "owner" } });
    console.log(`管理员已就绪：${email}`);
  }

  console.log("种子完成。");
}

/** 旧版种子把中文标签写成了 URL 编码的 slug（如 gui%E6%93%8D%E4%BD%9C），按名称映射原地改正，资源关联不变。 */
async function repairEncodedTagSlugs() {
  const broken = await prisma.tag.findMany({ where: { slug: { contains: "%" } } });
  for (const tag of broken) {
    let slug: string;
    try {
      slug = tagSlugFor(tag.name);
    } catch {
      console.warn(`  跳过标签「${tag.name}」：prisma/tag-slugs.ts 里没有映射，请到后台手动改 slug`);
      continue;
    }
    const clash = await prisma.tag.findUnique({ where: { slug } });
    if (clash && clash.id !== tag.id) {
      console.warn(`  跳过标签「${tag.name}」：slug ${slug} 已被「${clash.name}」占用，请到后台合并`);
      continue;
    }
    await prisma.tag.update({ where: { id: tag.id }, data: { slug } });
    console.log(`  已修复：${tag.name} → ${slug}`);
  }
}

/** 首批资源：只在资源表为空时执行一次。 */
async function seedResources(categoryMap: Map<string, string>, toolMap: Map<string, string>) {
  for (const item of SEED_RESOURCES) {
    const categoryId = categoryMap.get(item.categorySlug);
    if (!categoryId) continue;

    const resource = await prisma.resource.create({
      data: {
        slug: item.slug,
        name: item.name,
        summary: item.summary,
        description: item.description,
        categoryId,
        websiteUrl: item.websiteUrl ?? null,
        githubUrl: item.githubUrl ?? null,
        pricingType: item.pricingType,
        status: "published",
        featuredOrder: item.featuredOrder ?? null,
      },
    });

    for (const tagName of item.tags) {
      const tagSlug = tagSlugFor(tagName);
      const tag = await prisma.tag.upsert({ where: { slug: tagSlug }, update: {}, create: { name: tagName, slug: tagSlug } });
      await prisma.resourceTag.create({ data: { resourceId: resource.id, tagId: tag.id } });
    }

    for (const tSlug of item.toolSlugs ?? []) {
      const toolId = toolMap.get(tSlug);
      if (toolId) await prisma.resourceTool.create({ data: { resourceId: resource.id, toolId } });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
