const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
  console.error(
    "Missing environment variables. Ensure CLIENT_ID, CLIENT_SECRET, and REDIRECT_URI are set."
  );
  process.exit(1);
}

const STATE_KEY = "spotify_auth_state";
const users = {};

const generateRandomString = (length) => {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () =>
    possible.charAt(Math.floor(Math.random() * possible.length))
  ).join("");
};

app.get("/login", (req, res) => {
  const state = generateRandomString(16);
  res.cookie(STATE_KEY, state);

  const scope = "user-modify-playback-state user-read-playback-state";
  res.redirect(
    `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&scope=${encodeURIComponent(scope)}&state=${state}`
  );
});

app.get("/callback", async (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies[STATE_KEY] : null;

  if (state === null || state !== storedState) {
    res.status(403).send("State mismatch");
    return;
  }

  res.clearCookie(STATE_KEY);

  try {
    const tokenResponse = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        code,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }).toString(),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${CLIENT_ID}:${CLIENT_SECRET}`
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token } = tokenResponse.data;
    users[access_token] = { access_token, refresh_token };

    res.redirect("/");
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("Error authenticating");
  }
});

// Refresh Spotify access tokens
const refreshAccessToken = async (refresh_token) => {
  try {
    const tokenResponse = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token,
      }).toString(),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${CLIENT_ID}:${CLIENT_SECRET}`
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    return tokenResponse.data.access_token;
  } catch (error) {
    console.error(
      "Error refreshing token:",
      error.response?.data || error.message
    );
    return null;
  }
};

app.post("/sync", async (req, res) => {
  const { uris, context_uri, offset, position_ms } = req.body;

  if (!uris && !context_uri) {
    return res.status(400).send("You must provide either uris or context_uri.");
  }

  const payload = { position_ms };

  if (context_uri) {
    payload.context_uri = context_uri;
  }
  if (uris) {
    payload.uris = uris;
  }
  if (offset) {
    payload.offset = offset;
  }

  const promises = Object.entries(users).map(async ([accessToken, user]) => {
    try {
      await axios.put("https://api.spotify.com/v1/me/player/play", payload, {
        headers: { Authorization: `Bearer ${user.access_token}` },
      });
    } catch (error) {
      console.error(
        `Error syncing user: ${JSON.stringify(
          error.response?.data || error.message
        )}`
      );
    }
  });

  await Promise.all(promises);
  res.send("Playback synced for all users.");
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
