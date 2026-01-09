import cron from 'node-cron';
import { fetchStreamsByUserIds } from './twitchApi.js';
import { getTrackedStreamers, markNotified } from '../handlers/twitchSubscriptions.js';

const liveState = new Map();

const pollCron = process.env.TWITCH_POLL_CRON || '*/5 * * * *';

const notifySubscribers = async (client, streamer, stream) => {
    const message = `🔴 ${streamer.displayName} is live on Twitch!\n${stream.title}\nhttps://twitch.tv/${streamer.login}`;
    await Promise.all(streamer.subscribers.map(async (subscriberId) => {
        try {
            const user = await client.users.fetch(subscriberId);
            await user.send(message);
        } catch (err) {
            console.warn(`Failed to DM ${subscriberId} for ${streamer.login}: ${err.message}`);
        }
    }));
};

const handleLiveStatus = async (client) => {
    let streamers;
    try {
        streamers = await getTrackedStreamers();
    } catch (err) {
        console.error('Failed to load Twitch subscriptions', err);
        return;
    }

    if (!streamers.length) return;

    let streams = [];
    try {
        streams = await fetchStreamsByUserIds(streamers.map(s => s.id));
    } catch (err) {
        console.error('Failed to fetch Twitch streams', err);
        return;
    }

    const liveMap = new Map(streams.map(stream => [stream.user_id, stream]));

    for (const streamer of streamers) {
        const stream = liveMap.get(streamer.id);
        const isLive = Boolean(stream);
        const wasLive = liveState.get(streamer.id) || false;

        if (isLive && !wasLive) {
            await notifySubscribers(client, streamer, stream);
            liveState.set(streamer.id, true);
            await markNotified(streamer.id, stream.started_at);
        } else if (!isLive && wasLive) {
            liveState.set(streamer.id, false);
        }
    }
};

export const startTwitchMonitor = (client) => {
    try {
        const job = cron.schedule(pollCron, () => handleLiveStatus(client), { timezone: 'UTC' });
        job.start();
        // Run once on startup
        handleLiveStatus(client);
        return job;
    } catch (err) {
        console.error('Failed to start Twitch monitor', err);
        return null;
    }
};
