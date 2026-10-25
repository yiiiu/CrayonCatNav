## What is MCP?

[MCP](https://modelcontextprotocol.io/) is an open protocol that enables AI models to securely interact with local and remote resources through standardized server implementations. This list focuses on production-ready and experimental MCP servers that extend AI capabilities through file access, database connections, API integrations, and other contextual services.

## Clients

Checkout [awesome-mcp-clients](https://github.com/punkpeye/awesome-mcp-clients/) and [glama.ai/mcp/clients](https://glama.ai/mcp/clients).

## Remote Servers

This list is for servers with a GitHub repo you install and run yourself. Looking for a hosted server you just connect to over a URL? See [awesome-remote-mcp-servers](https://github.com/punkpeye/awesome-remote-mcp-servers).

## Tutorials

* [Tool Definition Quality Score (TDQS)](https://github.com/glama-ai/tool-definition-quality-score)
* [Model Context Protocol (MCP) Quickstart](https://glama.ai/blog/2024-11-25-model-context-protocol-quickstart)
* [Setup Claude Desktop App to Use a SQLite Database](https://youtu.be/wxCCzo9dGj0)

## Community

* [r/mcp Reddit](https://www.reddit.com/r/mcp)
* [Discord Server](https://glama.ai/mcp/discord)

## Legend

* 🎖️ – official implementation
* programming language
## Server Implementations

> [!NOTE]
> We now have a [web-based directory](https://glama.ai/mcp/servers) that is synced with the repository.

### 🔗 <a name="aggregators"></a>Aggregators

Servers for accessing many apps and tools through a single MCP server.
- [inth3shadows/terse](https://github.com/inth3shadows/terse) [![inth3shadows/terse MCP server](https://glama.ai/mcp/servers/inth3shadows/terse/badges/score.svg)](https://glama.ai/mcp/servers/inth3shadows/terse) 🐍 🏠 🍎 🪟 🐧 - Transparent proxy that sits in front of any other MCP server and shrinks its tool output before it reaches the model. Lossless by default — a denser encoding of the same bytes, with a round-trip gate asserting an exact inverse, so nothing is dropped or summarised. Repeated calls to the same tool emit a delta against the prior result instead of the whole payload. Per-tool opt-in, no decode step, no model in the loop. `uv tool install terse-mcp` then `terse proxy -- <server>`
- [402signalhq/402signal](https://github.com/402signalhq/402signal) [![402Signal MCP server](https://glama.ai/mcp/servers/402signalhq/402signal/badges/score.svg)](https://glama.ai/mcp/servers/402signalhq/402signal) 🐍 ☁️ - Checks and validates live x402 payment routes across Base, Solana and Algorand.
- [GarphenGate/moltline-mcp](https://github.com/GarphenGate/moltline-mcp) [![GarphenGate/moltline-mcp MCP server](https://glama.ai/mcp/servers/GarphenGate/moltline-mcp/badges/score.svg)](https://glama.ai/mcp/servers/GarphenGate/moltline-mcp) 🐍 ☁️ 🍎 🪟 🐧 - Bridge to Moltline Studio's hosted MCP servers: code review, agent governance, business math, regulatory deadlines, crypto tax lots, routing and optimization.
- [team886/findagent-mcp](https://github.com/team886/findagent-mcp) [![team886/findagent-mcp MCP server](https://glama.ai/mcp/servers/team886/findagent-mcp/badges/score.svg)](https://glama.ai/mcp/servers/team886/findagent-mcp) 📇 ☁️ - Marketplace of vetted agents with automated security scans plus human review, credential-to-host binding and sandboxed hosted code with default-deny egress.

### 📂 <a name="browser-automation"></a>Browser Automation

- [mcpqueen/mcpqueen](https://github.com/mcpqueen/mcpqueen) [![mcpqueen/mcpqueen MCP server](https://glama.ai/mcp/servers/mcpqueen/mcpqueen/badges/score.svg)](https://glama.ai/mcp/servers/mcpqueen/mcpqueen) 🎖️ 📇 ☁️ - Graded MCP registry: live-probes remote servers from the MCP Registry (initialization, tool listing, schema quality, latency, provenance) and publishes grades.
- [getanyapi-com/mcp](https://github.com/getanyapi-com/mcp) [![getanyapi-com/mcp MCP server](https://glama.ai/mcp/servers/getanyapi-com/mcp/badges/score.svg)](https://glama.ai/mcp/servers/getanyapi-com/mcp) 🎖️ 📇 ☁️ 🏠 - AnyAPI: scraping and data APIs for social media, search results, Google Maps, e-commerce and web data, with normalized JSON and automatic provider failover.

## Frameworks

> [!NOTE]
> More frameworks, utilities, and other developer tools are available at https://github.com/punkpeye/awesome-mcp-devtools

- [Nyrok/flompt](https://github.com/Nyrok/flompt) [![flompt MCP server](https://glama.ai/mcp/servers/@nyrok/flompt/badges/score.svg)](https://glama.ai/mcp/servers/@nyrok/flompt) 🐍 ☁️ - Visual prompt builder: decompose prompts into semantic blocks and compile them into Claude-optimized XML.
- [escapeboy/agent-fleet-o](https://github.com/escapeboy/agent-fleet-o) [![escapeboy/agent-fleet-o MCP server](https://glama.ai/mcp/servers/escapeboy/agent-fleet-o/badges/score.svg)](https://glama.ai/mcp/servers/escapeboy/agent-fleet-o) ☁️ 🏠 - Self-hosted mission control for AI agents: manage agents, experiments, workflows, crews, skills and more.
## Tips and Tricks

### Official prompt to inform LLMs how to use MCP

Want to ask Claude about Model Context Protocol?
