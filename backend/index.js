// index.js

const client_id = "YOUR_CLIENT_ID"; // Replace with your client ID
const redirect_uri = "http://localhost:8888/callback"; // Must match your Spotify app settings
const scopes = "user-read-private user-read-email"; // Scopes you need

// Build the authorization URL
const authUrl = `https://accounts.spotify.com/authorize? +
  client_id=${encodeURIComponent(client_id)} +
  &response_type=code +
  &redirect_uri=${encodeURIComponent(redirect_uri)} +
  &scope=${encodeURIComponent(scopes)}`;

// Redirect the user to Spotify login
window.location = authUrl;
// server.js

const express = require("express");
const axios = require("axios");
const app = express();

const client_id = "YOUR_CLIENT_ID";
const client_secret = "YOUR_CLIENT_SECRET";

app.get("/callback", async (req, res) => {
  const code = req.query.code || null;

  // Exchange code for access token
  const tokenResponse = await axios.post(
    "https://accounts.spotify.com/api/token",
    null,
    {
      params: {
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirect_uri,
        client_id: client_id,
        client_secret: client_secret,
      },
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  // tokenResponse.data contains access_token, refresh_token, etc.
  res.json(tokenResponse.data);
});

app.listen(8888, () => {
  console.log("Server running on http://localhost:8888");
});
