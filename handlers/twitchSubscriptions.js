import { executeQuery } from '../db/db.js';
import { fetchUsersByLogin } from '../twitch/twitchApi.js';

const mapRowToStreamer = (row) => ({
    id: row.id,
    login: row.login,
    displayName: row.display_name,
    profileImage: row.profile_image,
    lastNotifiedAt: row.last_notified_at,
});

const getStreamerByLogin = async (login) => {
    const lower = login.toLowerCase();
    const rows = await executeQuery(
        'SELECT id, login, display_name, profile_image, last_notified_at FROM twitch_streamers WHERE login = ? LIMIT 1',
        [lower]
    );
    const row = rows[0];
    return row ? mapRowToStreamer(row) : null;
};

const ensureStreamer = async (login) => {
    const existing = await getStreamerByLogin(login);
    if (existing) return existing;

    const users = await fetchUsersByLogin([login]);
    const user = users[0];
    if (!user) {
        throw new Error(`Twitch user '${login}' not found`);
    }

    await executeQuery(
        `INSERT INTO twitch_streamers (id, login, display_name, profile_image)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            login = VALUES(login),
            display_name = VALUES(display_name),
            profile_image = VALUES(profile_image)` ,
        [user.id, user.login.toLowerCase(), user.display_name, user.profile_image_url]
    );

    return {
        id: user.id,
        login: user.login.toLowerCase(),
        displayName: user.display_name,
        profileImage: user.profile_image_url,
        lastNotifiedAt: null,
    };
};

export const addStreamer = async (login) => {
    const existing = await getStreamerByLogin(login);
    if (existing) {
        return { streamer: existing, created: false };
    }
    const streamer = await ensureStreamer(login);
    return { streamer, created: true };
};

export const addSubscriber = async (login, discordUserId) => {
    const streamer = await ensureStreamer(login);
    const result = await executeQuery(
        'INSERT IGNORE INTO twitch_subscriptions (streamer_id, discord_user_id) VALUES (?, ?)',
        [streamer.id, discordUserId]
    );
    const alreadySubscribed = result.affectedRows === 0;
    return { streamer, alreadySubscribed };
};

export const removeSubscriber = async (login, discordUserId) => {
    const streamer = await getStreamerByLogin(login);
    if (!streamer) {
        return { removed: false, reason: 'not_tracking' };
    }
    const result = await executeQuery(
        'DELETE FROM twitch_subscriptions WHERE streamer_id = ? AND discord_user_id = ?',
        [streamer.id, discordUserId]
    );
    if (result.affectedRows === 0) {
        return { removed: false, reason: 'not_subscribed' };
    }
    return { removed: true, streamer };
};

export const listSubscriptionsForUser = async (discordUserId) => {
    const rows = await executeQuery(
        `SELECT ts.login, ts.display_name
         FROM twitch_subscriptions tsub
         JOIN twitch_streamers ts ON ts.id = tsub.streamer_id
         WHERE tsub.discord_user_id = ?
         ORDER BY ts.display_name`,
        [discordUserId]
    );
    return rows.map(row => ({ login: row.login, displayName: row.display_name }));
};

export const getTrackedStreamers = async () => {
    const rows = await executeQuery(
        `SELECT ts.id, ts.login, ts.display_name, ts.profile_image, ts.last_notified_at, tsub.discord_user_id
         FROM twitch_streamers ts
         JOIN twitch_subscriptions tsub ON tsub.streamer_id = ts.id`
    );

    const grouped = new Map();
    for (const row of rows) {
        const streamer = grouped.get(row.id) || {
            id: row.id,
            login: row.login,
            displayName: row.display_name,
            profileImage: row.profile_image,
            lastNotifiedAt: row.last_notified_at,
            subscribers: [],
        };
        streamer.subscribers.push(row.discord_user_id);
        grouped.set(row.id, streamer);
    }
    return Array.from(grouped.values());
};

export const markNotified = async (streamerId, notifiedAtIso) => {
    await executeQuery(
        'UPDATE twitch_streamers SET last_notified_at = ? WHERE id = ?',
        [notifiedAtIso, streamerId]
    );
};
