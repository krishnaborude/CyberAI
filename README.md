# CyberAI Bot

CyberAI is a production-focused Discord bot that uses Gemini to provide **ethical cybersecurity learning assistance** through slash commands.

## 1) Architecture

- **Discord Interface Layer**: `src/index.js` + `src/commands/*` handle slash interactions only.
- **AI Service Layer**: `src/services/geminiService.js` contains prompt orchestration and Gemini API calls.
- **Application Utilities**: `src/utils/*` provide input validation, prompt-injection checks, rate limiting, smart message chunking, and Discord reply helpers.
- **Command System**: `src/handlers/commandHandler.js` dynamically loads command modules.
- **Error Middleware**: `src/handlers/errorHandler.js` wraps command execution and sends safe user-facing failures.
- **Config Layer**: `src/config/env.js` validates environment variables at startup.

This separation keeps AI logic independent of Discord transport, so it can be reused later in a SaaS API/backend.

## 2) Folder Structure

```text
cyberai-bot/
  +-- src/
  ¦   +-- commands/
  ¦   ¦   +-- explain.js
  ¦   ¦   +-- labs.js
  ¦   ¦   +-- news.js
  ¦   ¦   +-- quiz.js
  ¦   ¦   +-- roadmap.js
  ¦   ¦   +-- tools.js
  ¦   +-- config/
  ¦   ¦   +-- env.js
  ¦   +-- handlers/
  ¦   ¦   +-- commandHandler.js
  ¦   ¦   +-- errorHandler.js
  ¦   +-- services/
  ¦   ¦   +-- geminiService.js
  ¦   +-- utils/
  ¦   ¦   +-- discordResponse.js
  ¦   ¦   +-- inputGuard.js
  ¦   ¦   +-- logger.js
  ¦   ¦   +-- rateLimiter.js
  ¦   ¦   +-- runAICommand.js
  ¦   ¦   +-- smartSplitMessage.js
  ¦   +-- index.js
  ¦   +-- registerCommands.js
  +-- .env.example
  +-- package.json
  +-- README.md
```

## 3) Slash Commands

- `/roadmap`
- `/explain`
- `/tools`
- `/labs`
- `/quiz`
- `/news`

## 4) Security Controls

- Input sanitization and validation (`src/utils/inputGuard.js`)
- Basic prompt injection pattern blocking
- In-memory per-user rate limiting (`src/utils/rateLimiter.js`)
- Safe API error handling and masked internal failures
- Secrets only via environment variables (`.env`, never commit keys)
- Ethical-only system prompt constraints in AI service

## 5) Smart Message Splitting

`src/utils/smartSplitMessage.js` exports:

- `smartSplitMessage(text)`

Behavior:
- If output is `> 1900` chars, split by double newline first.
- If still too long, split by sentence.
- Protect fenced code blocks and avoid splitting inside them.
- Multi-part responses add page headers like `?? CyberAI Response (1/3)`.
- Hard cap ensures Discord-compatible chunks (`<= 2000`).

## 6) Installation

1. Install Node.js LTS (Node 20+).
2. Clone the project and open folder.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create `.env` from `.env.example` and fill values.
5. Register slash commands:
   ```bash
   npm run register
   ```
6. Start bot:
   ```bash
   npm start
   ```

For local development:

```bash
npm run dev
```

## 7) Environment Variables

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODELS=gemini-flash-latest,gemini-2.0-flash
NODE_ENV=development
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=6
MAX_PROMPT_CHARS=1200
```

## 8) Deploy on VPS (24/7)

### Ubuntu example with PM2

1. Install Node.js LTS and Git.
2. Copy project to server.
3. Install dependencies:
   ```bash
   npm ci --omit=dev
   ```
4. Create production `.env`.
5. Register commands once:
   ```bash
   npm run register
   ```
6. Install PM2 and run app:
   ```bash
   npm i -g pm2
   pm2 start src/index.js --name cyberai-bot
   pm2 save
   pm2 startup
   ```
7. Check logs:
   ```bash
   pm2 logs cyberai-bot
   ```

### System hardening recommendations

- Run bot as non-root user.
- Restrict firewall to SSH only if bot does not expose HTTP ports.
- Store `.env` with strict permissions (`chmod 600 .env`).
- Rotate Discord and Gemini keys periodically.
- Add external uptime monitoring (Uptime Kuma / Better Stack / Pingdom).

## 9) Scaling Notes (10,000+ users)

- Move rate limiting from memory to Redis for multi-instance deployments.
- Add queueing/backpressure for AI calls.
- Add command analytics and structured observability (e.g., OpenTelemetry).
- Externalize chat/session context to database if personalized history is added.
- Reuse `GeminiService` in an HTTP API service when migrating to SaaS architecture.