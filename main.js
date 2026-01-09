import { Client, Partials, GatewayIntentBits, Collection } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Represents the client for the Dungeon RPG game.
 * @type {Client}
 */
const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
	partials: [Partials.GUILD_MEMBER, Partials.USER, Partials.REACTION, Partials.GUILD_MESSAGE, Partials.MESSAGE, Partials.GUILD_MESSAGE_REACTION, Partials.CHANNEL],
});

client.cooldowns = new Collection();

// Register events from the events folder
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const eventImport = await import(filePath);
	const event = eventImport.default;
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

client.login(process.env['DISCORD_SECRET']);