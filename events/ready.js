import { ActivityType, REST, Routes, Collection, Events, Client } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { startTwitchMonitor } from '../twitch/liveMonitor.js';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    name: Events.ClientReady,
    once: true,
    /**
     * Event handler for the 'ready' event.
     * 
     * @param {Client} client - The Discord client instance.
     */
    async execute(client) {
        const commands = await globalCommands(client);
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_SECRET);
        try {
            // register global commands
            await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
            console.log(`Global Commands: ${commands.map(cmd => cmd.name).join(', ')}`);
        } catch (error) {
            console.error(error);
        }

        console.log(`Ready, Logged in as ${client.user.tag}`);

        client.user.setPresence({
            activities: [{ name: '🔴 Live Monitor', type: ActivityType.Listening}],
            status: 'dnd',
        });

        // Begin polling Twitch for live notifications
        startTwitchMonitor(client);
    }
};

/**
 * Retrieves global commands and sets them in the client.
 * Also executes create and close actions for dungeons.
 * @param {Client} client - The Discord client.
 * @returns {Array} - An array of command data.
 */
const globalCommands = async (client) => {
    const commands = [];
    client.commands = new Collection();
    const commandsPath = path.join(__dirname, '../commands/global');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const commandImport = await import(filePath);
        const command = commandImport.default;
        if (!command || !command.data || !command.data.name) {
            console.error(`Failed to load command at ${filePath}`);
            continue;
        }
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    }
    
    return commands;
};