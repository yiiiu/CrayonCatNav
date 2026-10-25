/** 采集 Agent 的公共类型与常量（纯数据，前后端共用）。 */

export const candidateSources = ["mcp_registry", "github", "awesome", "huggingface", "producthunt", "manual"] as const;
export type CandidateSource = (typeof candidateSources)[number];

export const sourceLabels: Record<CandidateSource, string> = {
  mcp_registry: "MCP 官方 Registry",
  github: "GitHub",
  awesome: "awesome 清单",
  huggingface: "Hugging Face",
  producthunt: "Product Hunt",
  manual: "手动链接",
};

export const candidateStatuses = ["pending", "published", "drafted", "rejected"] as const;
export type CandidateStatusValue = (typeof candidateStatuses)[number];

export const candidateStatusLabels: Record<CandidateStatusValue, string> = {
  pending: "待审核",
  published: "已上架",
  drafted: "草稿",
  rejected: "已拒绝",
};

/** 来源返回的原始条目（模型整理之前）。所有文字都是来源原文，只作模型输入与审核参考。 */
export type RawCandidate = {
  source: CandidateSource;
  /** 条目在来源处的页面（Registry 详情、仓库页、清单原文等） */
  sourceUrl: string;
  title: string;
  websiteUrl: string | null;
  githubUrl: string | null;
  /** 来源原始简介（英文居多），不直接展示到前台 */
  description: string;
  /** star / likes / votes */
  stars: number | null;
  sourceUpdatedAt: Date | null;
  /** 额外线索（语言、topics、分组等），给模型参考 */
  hints?: string[];
};
