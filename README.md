![CyberAI - Ethical Cybersecurity Discord Bot](./assets/logo.png)

# CyberAI - Ethical Offensive Security Learning Assistant

## Abstract
CyberAI is a secure-by-design Discord bot for offensive and defensive cybersecurity learning in authorized environments. It combines input validation, prompt-injection resistance, scope-aware command gating, and reliable AI orchestration. The project is intended as a practical reference for building safer AI-powered chat assistants.

## Project Objective
CyberAI is designed to:
- Provide structured cybersecurity learning support for authorized labs/CTFs/internal simulations.
- Enforce safe-response discipline for dual-use security topics.
- Demonstrate production-minded AI integration patterns in Discord.
- Maintain modular architecture, observability, and operational reliability.

## Architecture Overview
### High-Level Data Flow
![High-level data flow: User -> Discord -> AI Service -> Safety Filter -> Response](./assets/image.png)

```text
Discord Slash Command
  -> Command Handler
  -> Input Guard (sanitize + validate + injection checks)
  -> Rate Limiter
  -> Gemini Service (prompt orchestration + retries/fallback)
  -> Response Formatter + Smart Split
  -> Discord Reply/Follow-up
```

### Component Responsibilities
| Layer | Responsibility | Key Files |
|---|---|---|
| Discord Interface | Slash command intake and interaction lifecycle | `src/index.js`, `src/commands/*` |
| Command Loader | Dynamic command registration/dispatch | `src/handlers/commandHandler.js` |
| Security Utilities | Input sanitation, scope checks, rate limiting | `src/utils/inputGuard.js`, `src/utils/rateLimiter.js` |
| AI Service | Prompting, safety constraints, retries, quality checks | `src/services/geminiService.js` |
| Search Services | Labs/resource/news sourcing and filtering | `src/services/labsSearchService.js`, `src/services/resourceSearchService.js`, `src/services/newsService.js` |
| Output Reliability | Formatting and Discord-safe chunking | `src/utils/formatResponse.js`, `src/utils/smartSplitMessage.js` |
| Error Middleware | Safe user-facing failures + logging | `src/handlers/errorHandler.js` |
| Config Layer | Environment validation and typed config | `src/config/env.js` |

## Command Surface
| Command | Purpose | Notes |
|---|---|---|
| `/roadmap` | Learning roadmap generation | Structured phased plan |
| `/studyplan` | Certification-focused offensive security study plan | Certification-aware + focus-dominant + alignment notes |
| `/explain` | Concept explanation | Structured teaching style |
| `/tools` | Tooling overview for labs | Safe command examples only |
| `/labs` | Search-grounded lab recommendations | Real links + platform filters |
| `/quiz` | Cybersecurity MCQ generation | Validated quiz format |
| `/news` | Live cybersecurity digest | Feed-grounded ranking |
| `/resource` | Search-grounded learning resources | Type-aware curation |
| `/redteam` | Authorized red-team guidance | Requires explicit authorized scope evidence |

## Study Plan Command
`/studyplan` requires all of the following inputs:
- `certification`
- `experience_level`
- `hours_per_week`
- `duration_weeks`
- `focus_area`

Output format:
1. Overview Summary
2. Weekly Breakdown
3. Skills Progression Milestones
4. Recommended Lab Types
5. Practice Strategy
6. Review & Reinforcement Plan
7. Final Exam Readiness Checklist
8. Certification Alignment Notes

## Security Controls
### 1) Input Validation and Sanitization
- Removes control characters and normalizes whitespace.
- Neutralizes mention-abuse patterns like `@everyone` and `@here`.
- Enforces prompt length limits.

Reference: `src/utils/inputGuard.js`

### 2) Prompt Injection Resistance
- Blocks common override/jailbreak patterns.
- Treats user input as untrusted data.

Reference: `src/utils/inputGuard.js`

### 3) Scope Enforcement for Offensive Guidance
- `/redteam` requires explicit authorized scope context.
- Out-of-scope requests are rejected before model invocation.

References: `src/commands/redteam.js`, `src/utils/runAICommand.js`

### 4) Abuse and Cost Control
- In-memory per-user rate limiting with configurable window/quota.

Reference: `src/utils/rateLimiter.js`

### 5) Grounded External Content Selection
- Labs/resources/news selection validates links against known candidate sets.

Reference: `src/services/geminiService.js`

### 6) Output Reliability
- Smart chunking for Discord limits.
- Heading-aware splitting and code-block protection.

Reference: `src/utils/smartSplitMessage.js`

## Installation and Run
### Requirements
- Node.js 20+
- Discord bot token + app client ID
- Gemini API key

### Quick Start
1. Install dependencies:
```bash
npm install
```
2. Configure environment variables in `.env`.
3. Register slash commands:
```bash
npm run register
```
4. Start:
```bash
npm start
```
For development:
```bash
npm run dev
```

## Environment Variables
| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Discord bot token |
| `DISCORD_CLIENT_ID` | Yes | Discord application client ID |
| `DISCORD_GUILD_ID` | No | Guild-scoped command registration |
| `GEMINI_API_KEY` | Yes | Primary Gemini API key |
| `GEMINI_API_KEY_2` | No | Secondary Gemini API key |
| `GEMINI_API_KEYS` | No | Comma-separated additional Gemini keys |
| `GEMINI_MODEL` | No | Primary model (default: `gemini-2.5-flash`) |
| `GEMINI_FALLBACK_MODELS` | No | Comma-separated fallback models |
| `GEMINI_MAX_RETRIES` | No | Retry count for transient errors |
| `GEMINI_RETRY_BASE_MS` | No | Exponential backoff base delay |
| `SERPER_API_KEY` | No | Search API key for `/labs` and `/resource` |
| `SERPER_API_KEY_2` | No | Secondary search API key |
| `SERPER_API_KEYS` | No | Comma-separated additional search keys |
| `RATE_LIMIT_WINDOW_MS` | No | Rate-limit window |
| `RATE_LIMIT_MAX_REQUESTS` | No | Max requests per user per window |
| `MAX_PROMPT_CHARS` | No | Max input prompt chars |
| `NODE_ENV` | No | Runtime environment |

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
- Run as non-root user.
- Restrict firewall to required ports only.
- Protect `.env` file permissions.
- Rotate API keys on a schedule.
- Add uptime and anomaly monitoring.

## Intended Use
CyberAI is intended for:
- Offensive security students
- CTF preparation
- Authorized internal lab simulations
- Defender-aware offensive learning

CyberAI is not intended for unauthorized real-world exploitation guidance.
