# Architecture Details

## High-Level Flow
```text
Discord Slash Command
  -> Command Handler
  -> Input Guard (sanitize + validate + injection checks)
  -> Rate Limiter
  -> Gemini Service (prompt orchestration + retries/fallback)
  -> Response Formatter + Smart Split
  -> Discord Reply/Follow-up
```

## Component Responsibilities
| Layer | Responsibility | Key Files |
|---|---|---|
| Discord Interface | Slash command intake and interaction lifecycle | `src/index.js`, `src/commands/*` |
| Command Loader | Dynamic command registration and dispatch | `src/handlers/commandHandler.js` |
| Security Utilities | Input sanitation, scope checks, and rate limiting | `src/utils/inputGuard.js`, `src/utils/rateLimiter.js` |
| AI Service | Prompt orchestration, safety constraints, retries, quality checks | `src/services/geminiService.js` |
| Search Services | Labs/resource/news sourcing and filtering | `src/services/labsSearchService.js`, `src/services/resourceSearchService.js`, `src/services/newsService.js` |
| Output Reliability | Formatting and Discord-safe chunking | `src/utils/formatResponse.js`, `src/utils/smartSplitMessage.js` |
| Error Middleware | Safe user-facing failures and logging | `src/handlers/errorHandler.js` |
| Config Layer | Environment validation and typed config | `src/config/env.js` |

## Reliability and Safety Notes
- Multi-key and fallback-model strategy for Gemini calls
- Retry with backoff for transient provider failures
- Quality checks for structured commands (`/studyplan`, `/roadmap`, `/quiz`, `/redteam`, `/explain`)
- Grounded curation/ranking for links shown by `/labs`, `/resource`, `/news`
- Scope-aware guardrails for dual-use offensive content
