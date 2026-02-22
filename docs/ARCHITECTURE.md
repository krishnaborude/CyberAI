# CyberAI Architecture

## Purpose
CyberAI is built as a Discord-native cybersecurity learning assistant that balances three goals:
- Practical value for learners preparing in authorized environments
- Consistent structure across outputs (roadmaps, study plans, quizzes, red-team guidance)
- Safety controls for dual-use cybersecurity topics

## System Context
```text
Discord User
  -> Slash Command
  -> Command Handler
  -> Input Guard + Scope Validation + Rate Limiter
  -> Gemini Service (prompt orchestration, retries, quality checks)
  -> Formatter + Smart Splitter
  -> Discord Reply / Follow-up
```

## Core Design Principles
- Safety-first request handling before model invocation
- Structured AI outputs instead of free-form responses
- Search-grounded links for labs, resources, and news
- Graceful degradation under provider/API failures
- Discord-friendly formatting and chunk delivery

## Runtime Request Flow
1. User triggers a slash command.
2. Command module validates required options and normalizes input.
3. `inputGuard` sanitizes text and blocks unsafe prompt patterns.
4. `rateLimiter` enforces per-user request quotas.
5. Command routes to either:
   - `runAICommand` + `geminiService` for generated content, or
   - Search services (`labsSearchService`, `resourceSearchService`, `newsService`) for grounded content.
6. Output is formatted and split using `smartSplitMessage`.
7. Response is sent through Discord interaction reply/edit/follow-up APIs.

## Component Map
| Layer | Responsibility | Key Files |
|---|---|---|
| Bot Entry | Startup, Discord client events, service wiring | `src/index.js` |
| Command Surface | Slash command definitions and per-command execution | `src/commands/*` |
| Command Dispatch | Dynamic command loading and routing | `src/handlers/commandHandler.js` |
| Input and Abuse Controls | Sanitization, prompt-injection checks, rate limiting | `src/utils/inputGuard.js`, `src/utils/rateLimiter.js` |
| AI Orchestration | Prompt construction, model fallback, retries, quality validation | `src/services/geminiService.js`, `src/services/prompts/*` |
| Grounded Search | Candidate retrieval for labs/resources/news | `src/services/labsSearchService.js`, `src/services/resourceSearchService.js`, `src/services/newsService.js` |
| Output Delivery | Markdown normalization, chunk-safe Discord delivery | `src/utils/formatResponse.js`, `src/utils/smartSplitMessage.js`, `src/utils/discordResponse.js` |
| Error Handling | User-safe failure responses and logging | `src/handlers/errorHandler.js`, `src/utils/logger.js` |
| Configuration | Environment loading and validation | `src/config/env.js` |

## Safety and Governance Controls
- Input sanitation and prompt-injection pattern blocking
- Authorized-scope checks for sensitive red-team style requests
- Guardrails in prompt templates to avoid weaponized output
- Grounding constraints so generated links must match fetched candidates
- Defensive framing for dual-use topics

## Reliability Model
- Multi-key API support and model fallback candidates
- Exponential backoff retries for transient provider errors
- Quality validation + refinement pass for structured commands
- Response length/chunk management for Discord limits

## Extensibility
CyberAI is modular by command and service. New features typically require:
1. Add a command file under `src/commands`.
2. Add a prompt builder under `src/services/prompts` (if AI-generated).
3. Extend `geminiService` quality/validation rules (if structured output).
4. Register command and update docs.

## Current Tradeoffs
- Rate limiting is in-memory (single-process scope)
- Prompt-injection detection is rule-based
- External dependency risk from model/search/feed providers
- No persistent memory by design (privacy-first)

## Planned Improvements
- Redis-backed distributed rate limiting
- Deeper policy-driven prompt risk scoring
- Optional analytics for command usage and quality outcomes
- Expanded integration tests for command output contracts
