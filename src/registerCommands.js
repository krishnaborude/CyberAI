const path = require('node:path');
const { REST, Routes } = require('discord.js');
const config = require('./config/env');
const { loadCommands } = require('./handlers/commandHandler');
const logger = require('./utils/logger');

async function registerCommands() {
  const commandsDir = path.join(__dirname, 'commands');
  const commandsCollection = loadCommands(commandsDir);
  const commands = [...commandsCollection.values()].map((command) => command.data.toJSON());
  const globalCommands = commands.map((command) => ({
    ...command,
    dm_permission: true
  }));

  const rest = new REST({ version: '10' }).setToken(config.discord.token);
  const { clientId, guildId, commandScope } = config.discord;
  const registerGuildCommands = commandScope === 'guild' || commandScope === 'both';
  const registerGlobalCommands = commandScope === 'global' || commandScope === 'both';

  if (registerGuildCommands) {
    if (!guildId) {
      throw new Error('DISCORD_GUILD_ID is required when DISCORD_COMMAND_SCOPE is guild or both.');
    }

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    logger.info('Registered guild slash commands', {
      guildId,
      count: commands.length
    });
  } else if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
    logger.info('Cleared guild slash commands to avoid duplicate server entries', { guildId });
  }

  if (registerGlobalCommands) {
    await rest.put(Routes.applicationCommands(clientId), { body: globalCommands });
    logger.info('Registered global slash commands', { count: globalCommands.length, dmEnabled: true });
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    logger.info('Cleared global slash commands to match guild-only scope');
  }
}

registerCommands().catch((error) => {
  logger.error('Failed to register commands', { error: error?.message || String(error) });
  process.exitCode = 1;
});
