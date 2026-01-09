## Twitch Live Alerts

A Discord bot that polls Twitch and sends direct messages to subscribers when tracked channels go live.

### Quick Start (Docker)

```bash
# 1. Clone and cd to repo
git clone <repo-url> && cd twitch-live-tracker

# 2. Create .env (see Environment Variables below)
cp .env.example .env  # or manually create with required vars

# 3. Start bot + MariaDB
docker-compose up --build
```

The bot registers slash commands on startup and begins polling Twitch immediately (default every 5 minutes, UTC).

### Environment Variables

**Required:**
- `DISCORD_SECRET` – Discord bot token
- `DISCORD_CLIENT_ID` – Discord application ID
- `TWITCH_CLIENT_ID` – Twitch OAuth app client ID
- `TWITCH_CLIENT_SECRET` – Twitch OAuth app client secret
- `DB_HOST` – Database hostname (e.g., `mariadb` in Docker)
- `DB_USER` – Database user
- `DB_PASSWORD` – Database password
- `DB_NAME` – Database name

**Optional:**
- `DB_PORT` – Database port (default: `3306`)
- `TWITCH_POLL_CRON` – Cron schedule for Twitch polling (default: `*/5 * * * *` every 5 min, UTC)
- `ALLOWED_ADDER_IDS` – Comma-separated Discord user IDs allowed to run `/twitch add` (e.g., `123456789,987654321`)

### Slash Commands

**For all users:**
- `/twitch subscribe user:<twitch_username>` – Subscribe to DM alerts when that channel goes live.
- `/twitch unsubscribe user:<twitch_username>` – Unsubscribe from alerts.
- `/twitch list` – Show your current subscriptions (ephemeral).

**For admins** (if `ALLOWED_ADDER_IDS` is set):
- `/twitch add user:<twitch_username>` – Force-track a streamer before any user subscribes. Useful for proactive tracking.

### How It Works

1. **Startup**: Bot loads Discord events and commands, registers slash commands (global + per-server if `DISCORD_SERVER_ID` is set).
2. **Subscription**: User runs `/twitch subscribe <username>` → bot fetches Twitch user info → stores in `twitch_streamers` and `twitch_subscriptions` tables.
3. **Polling**: Cron job fires every 5 minutes → fetches all tracked streamers from DB → queries Twitch Streams API → detects go-live edges (state transition from offline → live).
4. **Notifications**: For each subscriber, bot sends a DM with stream title and link; records notification time in DB to prevent spam.
5. **Presence**: Bot shows "🔴 Live Monitor" activity (status: `dnd`).

### Database Schema

Tables are auto-created by [dbsetup.sql](dbsetup.sql) when using Docker Compose. For manual setup:

```sql
CREATE TABLE IF NOT EXISTS twitch_streamers (
    id VARCHAR(64) PRIMARY KEY,
    login VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(150) NOT NULL,
    profile_image VARCHAR(500),
    last_notified_at DATETIME NULL
);

CREATE TABLE IF NOT EXISTS twitch_subscriptions (
    streamer_id VARCHAR(64) NOT NULL,
    discord_user_id VARCHAR(40) NOT NULL,
    PRIMARY KEY (streamer_id, discord_user_id),
    FOREIGN KEY (streamer_id) REFERENCES twitch_streamers(id) ON DELETE CASCADE
);
```

**Tables:**
- `twitch_streamers` – Tracked Twitch channels with cached metadata and last notification timestamp.
- `twitch_subscriptions` – Links Discord users to streamer subscriptions; cascade delete.

### Local Development (without Docker)

1. Install Node.js 22+, MariaDB 10.4+
2. Create `.env` with all required vars (set `DB_HOST=localhost`)
3. Run MariaDB and bootstrap schema: `mysql -u root -p < dbsetup.sql`
4. Install and start: `npm install && npm start`

