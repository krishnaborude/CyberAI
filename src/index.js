const path = require('node:path');
const { Client, Events, GatewayIntentBits } = require('discord.js');
const config = require('./config/env');
const logger = require('./utils/logger');
const RateLimiter = require('./utils/rateLimiter');
const GeminiService = require('./services/geminiService');
const NewsService = require('./services/newsService');
const LabsSearchService = require('./services/labsSearchService');
const { loadCommands } = require('./handlers/commandHandler');
const { safeExecute } = require('./handlers/errorHandler');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const commandsDir = path.join(__dirname, 'commands');
client.commands = loadCommands(commandsDir);
const gemini = new GeminiService({
  apiKey: config.gemini.apiKey,
  model: config.gemini.model,
  fallbackModels: config.gemini.fallbackModels,
  maxRetries: config.gemini.maxRetries,
  retryBaseMs: config.gemini.retryBaseMs,
  logger
});

client.services = {
  gemini,
  news: new NewsService({ logger, gemini }),
  labsSearch: new LabsSearchService({ apiKey: config.serper.apiKey, logger })
};
client.rateLimiter = new RateLimiter(config.rateLimit);

client.once(Events.ClientReady, (readyClient) => {
  logger.info('CyberAI bot is online', {
    user: readyClient.user.tag,
    commandsLoaded: client.commands.size,
    env: config.nodeEnv
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    await interaction.reply({
      content: 'Command not found. Please re-register slash commands.',
      ephemeral: true
    });
    return;
  }

  await safeExecute(
    interaction,
    async () => {
      await command.execute({
        interaction,
        services: client.services,
        rateLimiter: client.rateLimiter,
        config,
        logger
      });
    },
    logger
  );
});

client.on('error', (error) => {
  logger.error('Discord client error', { error: error?.message || String(error) });
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection', { error: error?.message || String(error) });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error?.message || String(error) });
});

client.login(config.discord.token);
