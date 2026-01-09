import { SlashCommandBuilder } from 'discord.js';
import { addSubscriber, removeSubscriber, listSubscriptionsForUser, addStreamer } from '../../handlers/twitchSubscriptions.js';

const allowedAdderIds = new Set((process.env.ALLOWED_ADDER_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean));

export default {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('twitch')
        .setDescription('Manage Twitch live alerts')
        .addSubcommand(sub =>
            sub.setName('subscribe')
                .setDescription('Subscribe to alerts for a Twitch streamer')
                .addStringOption(opt =>
                    opt.setName('user')
                        .setDescription('Twitch username')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('unsubscribe')
                .setDescription('Stop alerts for a Twitch streamer')
                .addStringOption(opt =>
                    opt.setName('user')
                        .setDescription('Twitch username')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Show your current Twitch subscriptions'))
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Admins: ensure a streamer is tracked by username')
                .addStringOption(opt =>
                    opt.setName('user')
                        .setDescription('Twitch username')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const requesterId = interaction.user.id;

        if (subcommand === 'list') {
            const subs = await listSubscriptionsForUser(requesterId);
            if (!subs.length) {
                return interaction.reply({ content: 'You are not subscribed to any Twitch streamers yet.', ephemeral: true });
            }
            const lines = subs.map(s => `• ${s.displayName} (twitch.tv/${s.login})`);
            return interaction.reply({ content: `You are subscribed to ${subs.length} streamer(s):\n${lines.join('\n')}`, ephemeral: true });
        }

        const login = interaction.options.getString('user', true).trim();
        await interaction.deferReply({ ephemeral: true });

        if (subcommand === 'subscribe') {
            try {
                const { streamer, alreadySubscribed } = await addSubscriber(login, requesterId);
                if (alreadySubscribed) {
                    return interaction.editReply(`You are already subscribed to ${streamer.displayName} (twitch.tv/${streamer.login}).`);
                }
                return interaction.editReply(`Subscribed to ${streamer.displayName}! You will get a DM when they go live.`);
            } catch (err) {
                return interaction.editReply(`Could not subscribe: ${err.message}`);
            }
        }

        if (subcommand === 'unsubscribe') {
            const result = await removeSubscriber(login, requesterId);
            if (!result.removed) {
                if (result.reason === 'not_tracking') {
                    return interaction.editReply(`I am not tracking ${login}.`);
                }
                return interaction.editReply(`You are not subscribed to ${login}.`);
            }
            return interaction.editReply(`Unsubscribed from ${result.streamer.displayName}.`);
        }

        if (subcommand === 'add') {
            if (!allowedAdderIds.has(requesterId)) {
                return interaction.editReply('You are not allowed to add tracked streamers.');
            }
            try {
                const { streamer, created } = await addStreamer(login);
                if (created) {
                    return interaction.editReply(`Added ${streamer.displayName} (twitch.tv/${streamer.login}) to tracking.`);
                }
                return interaction.editReply(`${streamer.displayName} (twitch.tv/${streamer.login}) is already tracked.`);
            } catch (err) {
                return interaction.editReply(`Could not add streamer: ${err.message}`);
            }
        }
    },
};
