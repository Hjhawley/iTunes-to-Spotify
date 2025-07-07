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
