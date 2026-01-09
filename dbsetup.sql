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