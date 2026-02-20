![CyberAI - Ethical Cybersecurity Discord Bot](./assets/logo.png)

# CyberAI - Ethical Offensive Security Learning Assistant

## Abstract

CyberAI is a secure-by-design Discord bot that demonstrates defensive AI orchestration in offensive security education contexts. It integrates layered input validation, prompt-injection resistance, authorization-aware command gating, and operational reliability controls. The project focuses on secure LLM integration within real-world chat infrastructure and targets ethical, lab-constrained offensive security learning. It is intended as a production-quality reference for secure AI integration in chat environments.

## Project Objective

CyberAI is designed to:

- Provide structured offensive security learning assistance for authorized environments.
- Enforce ethical boundaries and safe-response discipline in LLM outputs.
- Demonstrate secure-by-design AI orchestration in a real chat application.
- Maintain production-ready engineering practices (modular design, config validation, fault handling, observability).

## Security-First Design Principles

- Least privilege and explicit scope: sensitive red-team guidance requires clear authorized scope.
- Fail-closed boot: required environment variables are validated at startup.
- Defense in depth: multiple layers (input sanitization, abuse controls, prompt controls, output controls).
- Controlled disclosure: internal failures are logged, user responses remain sanitized.
- Transport-agnostic AI layer: AI orchestration is isolated from Discord transport for safer reuse.

## Architecture Overview

### High-Level Data Flow

![High-level data flow: User → Discord → AI Service → Safety Filter → Response](./assets/image.png)


```text
Discord Slash Command
  -> Command Handler
  -> Input Guard (sanitize + validate + injection checks)
  -> Rate Limiter
  -> Gemini Service (prompt orchestration + model retries/fallback)
  -> Response Formatter + Smart Split
  -> Discord Reply/Follow-up
```

### Component Responsibilities

| Layer | Responsibility | Key Files |
|---|---|---|
| Discord Interface | Slash command intake and interaction lifecycle | `src/index.js`, `src/commands/*` |
| Command Loader | Dynamic command registration/dispatch | `src/handlers/commandHandler.js` |
| Security Utilities | Input sanitation, scope checks, rate limiting | `src/utils/inputGuard.js`, `src/utils/rateLimiter.js` |
| AI Service | Prompt design, safety constraints, retries, quality checks | `src/services/geminiService.js` |
| Search-Grounded Services | Labs/resource/news sourcing and filtering | `src/services/labsSearchService.js`, `src/services/resourceSearchService.js`, `src/services/newsService.js` |
| Output Reliability | Formatting and Discord-safe chunking | `src/utils/formatResponse.js`, `src/utils/smartSplitMessage.js` |
| Error Middleware | Safe user-facing failures + logging | `src/handlers/errorHandler.js` |
| Config Layer | Environment validation and typed config | `src/config/env.js` |

## Command Surface

| Command | Purpose | Security Notes |
|---|---|---|
| `/roadmap` | Learning roadmap generation | Input guard + rate limiting + constrained prompting |
| `/explain` | Concept explanation | Safety-constrained educational output |
| `/tools` | Tooling overview for labs | No weaponized output policy |
| `/labs` | Search-grounded lab recommendations | External link grounding + platform filtering |
| `/quiz` | Cybersecurity MCQ generation | Structured format validation |
| `/news` | Live cybersecurity digest | Feed-grounded ranking and source links |
| `/resource` | Search-grounded learning resources | Type-aware curation + link allow-list |
| `/redteam` | Authorized red-team guidance | Requires explicit authorized scope evidence |

## Security Controls and Defensive Design

### 1) Input Validation and Sanitization

- Control characters are removed and whitespace normalized.
- Mention-abuse vectors such as `@everyone` and `@here` are neutralized.
- Prompt length is bounded (`MAX_PROMPT_CHARS`) to reduce abuse and token exhaustion.
- Minimal input quality checks prevent empty/low-signal prompts.

Reference: `src/utils/inputGuard.js`

### 2) Prompt Injection Resistance

- Common override patterns are blocked (instruction override, jailbreak framing, hidden prompt extraction attempts).
- Untrusted user input is treated as data, not executable instruction hierarchy.

Reference: `src/utils/inputGuard.js`

### 3) Authorized Scope Enforcement for Offensive Guidance

- `/redteam` requires explicit scope markers (lab/CTF/authorized/internal context).
- Requests without authorization context are rejected before model invocation.
- Red-team outputs are constrained to methodology, defender relevance, and non-weaponized guidance.

References: `src/commands/redteam.js`, `src/utils/runAICommand.js`, `src/services/geminiService.js`

### 4) Abuse and Cost Control

- In-memory per-user rate limiting with configurable window and quota.
- Predictable rejection behavior under abuse spikes.

Reference: `src/utils/rateLimiter.js`

### 5) Secret and Configuration Hygiene

- Required secrets are validated at startup.
- No secret hardcoding in source.
- Optional key rotation patterns supported (multiple Gemini and Serper keys).

Reference: `src/config/env.js`

### 6) Grounded External Content Selection

- Labs/resources/news post-processing validates selected links against provider-returned allow-lists.
- Reduces risk of model-invented URLs and ungrounded recommendations.

Reference: `src/services/geminiService.js`

### 7) Safe Error Handling and Observability

- User-facing errors are generic and safe.
- Detailed internal context is logged for operators.

References: `src/handlers/errorHandler.js`, `src/utils/logger.js`

### 8) Output Reliability for Discord Constraints

- Automatic smart chunking for Discord message limits.
- Headings/paragraph-aware split strategy with code-block protection.
- Hard cap enforcement prevents delivery failures.

Reference: `src/utils/smartSplitMessage.js`

## Threat Model

### Protected Assets
- Discord bot token
- Gemini API key material
- Prompt policy and guardrail integrity
- Service availability and cost envelope
- Response integrity for learning workflows

### Trust Boundaries

- External user input -> bot runtime
- Bot runtime -> third-party APIs (Gemini, search/news providers)
- Application logs/config -> host environment

### Threats and Mitigations

| Threat | Attack Path | Impact | Mitigations | Residual Risk |
|---|---|---|---|---|
| Prompt injection | User attempts instruction override | Unsafe or policy-breaking output | Pattern blocking, constrained system prompt, command-level rules | Pattern-based filters can miss novel phrasing |
| Abuse/spam | High-rate command flooding | Cost spikes, degraded UX | Per-user rate limiting + retry feedback | Distributed abuse across many accounts |
| Unauthorized offensive use | Real-target offensive prompting | Legal/ethical breach | Authorized-scope checks + strict red-team constraints | Social engineering in scope text |
| Hallucinated links/content | Model invents resources/labs/news | Misleading guidance | Grounded selection against known links | Upstream source quality variance |
| Secret mishandling | Misconfiguration or accidental leakage | Credential compromise | Env-only secrets, startup validation, operational hardening guidance | Host-level compromise remains possible |
| Output truncation | Long responses exceed limits | Incomplete guidance | Smart chunking + hard caps + retry strategies | Very long model outputs can still require operator tuning |

## Known Limitations

- Injection detection is primarily pattern- and rule-based, not semantic or model-assisted.
- In-memory, per-process rate limiting does not mitigate distributed or multi-bot abuse.
- No external content-moderation API is integrated beyond system prompt and guardrail constraints.
- Safety relies in part on third-party LLM provider controls and enforcement.

## Risk Considerations

- Current rate limiter is in-memory and per-process; horizontal deployments require Redis-backed centralization.
- Prompt-injection detection is rule-based; semantic/ML-based detection can improve resilience.
- Third-party provider dependencies (LLM/search/news) introduce availability and data-quality risks.
- No persistent chat memory is used by default, reducing privacy risk but limiting session continuity.

## Production Readiness

Implemented today:

- Modular architecture with clear separation of concerns.
- Startup config validation and environment-based secret management.
- Structured command pipeline with centralized guardrails.
- Retry/backoff and model fallback behavior in AI service.
- Operational logging and safe error boundaries.
- Discord-safe response chunking and formatting safeguards.

Recommended before large-scale deployment:

- Redis-backed distributed rate limiting.
- Request queue/backpressure for AI calls.
- Structured metrics and tracing (OpenTelemetry-compatible pipeline).
- Automated unit tests for `inputGuard`, `rateLimiter`, and chunking logic.

## Installation and Run

### Requirements

- Node.js 20+
- Discord application and bot token
- Gemini API key

### Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and set required values.

3. Register slash commands:

```bash
npm run register
```

4. Start the bot:

```bash
npm start
```
## Installation and Run

### Requirements

- Node.js 20+
- Discord application and bot token
- Gemini API key

### Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and set required values.

3. Register slash commands:

```bash
npm run register
```

4. Start the bot:

```bash
npm start
```

For development:
For development:

```bash
npm run dev
```

## Environment Variables
## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Discord bot token |
| `DISCORD_CLIENT_ID` | Yes | Discord application client ID |
| `DISCORD_GUILD_ID` | No | Guild-scoped registration target |
| `GEMINI_API_KEY` | Yes | Primary Gemini key |
| `GEMINI_API_KEY_2` | No | Secondary Gemini key |
| `GEMINI_API_KEYS` | No | Comma-separated additional Gemini keys |
| `GEMINI_MODEL` | No | Primary model (default `gemini-2.5-flash`) |
| `GEMINI_FALLBACK_MODELS` | No | Comma-separated model fallbacks |
| `GEMINI_MAX_RETRIES` | No | Retry count for retriable provider errors |
| `GEMINI_RETRY_BASE_MS` | No | Exponential backoff base delay |
| `SERPER_API_KEY` | No | Search provider key for `/labs` and `/resource` |
| `SERPER_API_KEY_2` | No | Secondary search provider key |
| `SERPER_API_KEYS` | No | Comma-separated additional search keys |
| `RATE_LIMIT_WINDOW_MS` | No | Rate-limit window |
| `RATE_LIMIT_MAX_REQUESTS` | No | Max requests per user per window |
| `MAX_PROMPT_CHARS` | No | Input length cap |
| `NODE_ENV` | No | Runtime mode |

## Deployment (VPS/24x7)

Example with PM2:

```bash
npm ci --omit=dev
npm run register
npm i -g pm2
pm2 start src/index.js --name cyberai-bot
pm2 save
pm2 startup
pm2 logs cyberai-bot
```
| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Discord bot token |
| `DISCORD_CLIENT_ID` | Yes | Discord application client ID |
| `DISCORD_GUILD_ID` | No | Guild-scoped registration target |
| `GEMINI_API_KEY` | Yes | Primary Gemini key |
| `GEMINI_API_KEY_2` | No | Secondary Gemini key |
| `GEMINI_API_KEYS` | No | Comma-separated additional Gemini keys |
| `GEMINI_MODEL` | No | Primary model (default `gemini-2.5-flash`) |
| `GEMINI_FALLBACK_MODELS` | No | Comma-separated model fallbacks |
| `GEMINI_MAX_RETRIES` | No | Retry count for retriable provider errors |
| `GEMINI_RETRY_BASE_MS` | No | Exponential backoff base delay |
| `SERPER_API_KEY` | No | Search provider key for `/labs` and `/resource` |
| `SERPER_API_KEY_2` | No | Secondary search provider key |
| `SERPER_API_KEYS` | No | Comma-separated additional search keys |
| `RATE_LIMIT_WINDOW_MS` | No | Rate-limit window |
| `RATE_LIMIT_MAX_REQUESTS` | No | Max requests per user per window |
| `MAX_PROMPT_CHARS` | No | Input length cap |
| `NODE_ENV` | No | Runtime mode |

## Deployment (VPS/24x7)

Example with PM2:

```bash
npm ci --omit=dev
npm run register
npm i -g pm2
pm2 start src/index.js --name cyberai-bot
pm2 save
pm2 startup
pm2 logs cyberai-bot
```

Hardening checklist:
Hardening checklist:

- Run as non-root user.
- Restrict host firewall to required ports only.
- Store `.env` with strict filesystem permissions.
- Rotate API keys on a defined schedule.
- Add external uptime and anomaly monitoring.

## Secure Development Notes

- Keep command handlers thin; business logic belongs in services/utilities.
- Route AI interactions through `runAICommand` for consistent guardrails.
- Do not bypass input guard or rate limiter in new commands.
- Keep user-facing failures sanitized and avoid leaking internals.

## Intended Use

CyberAI is intended for:

- Offensive security students
- CTF preparation
- Authorized internal lab simulations
- Defensive-awareness reinforcement for offensive workflows

CyberAI is not intended for unauthorized real-world exploitation guidance.

## Alignment With Offensive Security Engineering Principles

This project demonstrates:

- Enumeration discipline in how commands, threats, and controls are explicitly surfaced and documented.
- Explicit scope enforcement for offensive workflows, especially `/redteam` and lab-only guidance.
- Attack-chain contextualization that ties offensive techniques to defender visibility and mitigation.
- Responsible disclosure mindset and emphasis on ethical, authorized use in all workflows and documentation.

- Run as non-root user.
- Restrict host firewall to required ports only.
- Store `.env` with strict filesystem permissions.
- Rotate API keys on a defined schedule.
- Add external uptime and anomaly monitoring.

## Secure Development Notes

- Keep command handlers thin; business logic belongs in services/utilities.
- Route AI interactions through `runAICommand` for consistent guardrails.
- Do not bypass input guard or rate limiter in new commands.
- Keep user-facing failures sanitized and avoid leaking internals.

## Intended Use

CyberAI is intended for:

- Offensive security students
- CTF preparation
- Authorized internal lab simulations
- Defensive-awareness reinforcement for offensive workflows

CyberAI is not intended for unauthorized real-world exploitation guidance.

## Alignment With Offensive Security Engineering Principles

This project demonstrates:

- Enumeration discipline in how commands, threats, and controls are explicitly surfaced and documented.
- Explicit scope enforcement for offensive workflows, especially `/redteam` and lab-only guidance.
- Attack-chain contextualization that ties offensive techniques to defender visibility and mitigation.
- Responsible disclosure mindset and emphasis on ethical, authorized use in all workflows and documentation.
