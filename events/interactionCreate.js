import { Events } from 'discord.js';

export default {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
            await interaction.reply({ content: 'Command not found.', ephemeral: true });
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: 'There was an error while executing this command.' });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command.', ephemeral: true });
            }
        }
    },
};
