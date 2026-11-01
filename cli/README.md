# crayoncat

蜡笔猫导航（CrayonCatNav）命令行工具：在终端、脚本或 AI Agent 里查询经过人工审核的 AI 资源——MCP 服务、Agent Skills、AI 编程工具、模型 API、UI 组件库等。

```bash
npx crayoncat categories
npx crayoncat search "React 无样式组件" --category ui-components --limit 5
npx crayoncat show shadcn-ui
npx crayoncat show shadcn-ui --json   # 给 Agent / 脚本用
```

- 零依赖，需要 Node.js 20+
- 匿名使用，无需 API Key；每个 IP 每分钟 60 次、每天 2000 次
- 服务地址可用 `--base` 或环境变量 `CRAYONCAT_BASE_URL` 覆盖

完整文档：https://www.crayoncat.online/docs/cli

退出码：0 成功，1 请求失败，2 参数错误，4 资源不存在。
