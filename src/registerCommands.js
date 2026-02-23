const path = require('node:path');
const { REST, Routes } = require('discord.js');
const config = require('./config/env');
const { loadCommands } = require('./handlers/commandHandler');
const logger = require('./utils/logger');

async function registerCommands() {
  const commandsDir = path.join(__dirname, 'commands');
  const commandsCollection = loadCommands(commandsDir);
  const commands = [...commandsCollection.values()].map((command) => command.data.toJSON());

  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  if (config.discord.guildId) {
    await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
      { body: commands }
    );
    logger.info('Registered guild slash commands', {
      guildId: config.discord.guildId,
      count: commands.length
    });
  }

  await rest.put(Routes.applicationCommands(config.discord.clientId), { body: commands });
  logger.info('Registered global slash commands', { count: commands.length });
}

registerCommands().catch((error) => {
  logger.error('Failed to register commands', { error: error?.message || String(error) });
  process.exitCode = 1;
});
