/**
 * 中文标签 → 英文 slug 映射（slug 规则见 lib/validation/common.ts：小写字母、数字、连字符）。
 * 新增中文标签时在这里补一条；未收录的中文标签会让种子直接报错，避免再出现 URL 编码的 slug。
 */
export const TAG_SLUGS: Record<string, string> = {
  编辑器: "editor",
  智能补全: "smart-completion",
  终端: "terminal",
  代码补全: "code-completion",
  IDE插件: "ide-plugin",
  前端生成: "frontend-generation",
  在线开发: "online-ide",
  全栈: "full-stack",
  沙盒: "sandbox",
  代码审查: "code-review",
  官方服务: "official-server",
  文件管理: "file-management",
  数据库: "database",
  搜索: "search",
  联网检索: "web-search",
  正文提取: "content-extraction",
  网页转换: "web-to-markdown",
  记忆管理: "memory",
  知识图谱: "knowledge-graph",
  自动化: "automation",
  浏览器: "browser",
  开源平台: "open-source-platform",
  工作流: "workflow",
  Bot平台: "bot-platform",
  多智能体: "multi-agent",
  插件系统: "plugin-system",
  任务编排: "task-orchestration",
  自主智能体: "autonomous-agent",
  GUI操作: "gui-automation",
  多模态: "multimodal",
  状态机: "state-machine",
  流程编排: "flow-orchestration",
  旗舰模型: "flagship-model",
  编程标杆: "coding-benchmark",
  高速API: "fast-api",
  开源模型: "open-weights",
  深度推理: "deep-reasoning",
  性价比: "cost-effective",
  百万上下文: "1m-context",
  本地运行: "run-locally",
  开源: "open-source",
  极速推理: "fast-inference",
  Web界面: "web-ui",
  自托管: "self-hosted",
  桌面客户端: "desktop-app",
  跨平台: "cross-platform",
  本地私有: "local-private",
  推理加速: "inference-acceleration",
  生产部署: "production-deployment",
  高并发: "high-concurrency",
  知识库: "knowledge-base",
  数据框架: "data-framework",
  应用开发: "app-development",
  生态: "ecosystem",
  中间件: "middleware",
  模型评测: "model-evaluation",
  竞技场: "arena",
  微调: "fine-tuning",
  图像生成: "image-generation",
  艺术设计: "art-design",
  商业插画: "commercial-illustration",
  开源生图: "open-source-image-gen",
  提示词控制: "prompt-control",
  照片级: "photorealistic",
  音乐生成: "music-generation",
  歌词编曲: "lyrics-arrangement",
  AI音频: "ai-audio",
  视频生成: "video-generation",
  运镜控制: "camera-control",
  影视后期: "post-production",
  实时绘图: "realtime-drawing",
  超分辨率: "super-resolution",
  设计辅助: "design-assist",
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 标签名 → slug：中文查表，英文按规则转换；结果不合法时抛错。 */
export function tagSlugFor(name: string): string {
  const slug =
    TAG_SLUGS[name] ??
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  if (!SLUG_RE.test(slug) || slug.length < 2 || slug.length > 64) {
    throw new Error(`标签「${name}」没有合法 slug，请在 prisma/tag-slugs.ts 补充映射`);
  }
  return slug;
}
