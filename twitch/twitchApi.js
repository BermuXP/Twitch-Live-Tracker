import dotenv from 'dotenv';
import { setTimeout as delay } from 'timers/promises';

dotenv.config();

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const USERS_URL = 'https://api.twitch.tv/helix/users';
const STREAMS_URL = 'https://api.twitch.tv/helix/streams';

let cachedToken = { token: null, expiresAt: 0 };

const getCredentials = () => {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new Error('Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET in environment');
    }
    return { clientId, clientSecret };
};

const getAppToken = async () => {
    const now = Date.now();
    if (cachedToken.token && cachedToken.expiresAt > now + 60_000) {
        return cachedToken.token;
    }
    const { clientId, clientSecret } = getCredentials();
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
    });
    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    if (!res.ok) {
        throw new Error(`Twitch token request failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    cachedToken = {
        token: data.access_token,
        expiresAt: now + (data.expires_in || 0) * 1000,
    };
    return cachedToken.token;
};

const twitchFetch = async (url, signal) => {
    const { clientId } = getCredentials();
    const token = await getAppToken();
    const res = await fetch(url, {
        headers: {
            'Client-ID': clientId,
            'Authorization': `Bearer ${token}`,
        },
        signal,
    });
    if (res.status === 429) {
        // basic backoff on rate limit
        await delay(1000);
        return twitchFetch(url, signal);
    }
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Twitch API error ${res.status}: ${body || res.statusText}`);
    }
    return res.json();
};

const chunk = (arr, size = 90) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
};

export const fetchUsersByLogin = async (logins) => {
    if (!logins || !logins.length) return [];
    const lower = logins.map(l => l.toLowerCase());
    const groups = chunk(lower, 90);
    const results = [];
    for (const group of groups) {
        const qs = new URLSearchParams();
        group.forEach(login => qs.append('login', login));
        const data = await twitchFetch(`${USERS_URL}?${qs.toString()}`);
        if (data?.data?.length) results.push(...data.data);
    }
    return results;
};

export const fetchStreamsByUserIds = async (userIds) => {
    if (!userIds || !userIds.length) return [];
    const groups = chunk(userIds, 90);
    const results = [];
    for (const group of groups) {
        const qs = new URLSearchParams();
        group.forEach(id => qs.append('user_id', id));
        const data = await twitchFetch(`${STREAMS_URL}?${qs.toString()}`);
        if (data?.data?.length) results.push(...data.data);
    }
    return results;
};
