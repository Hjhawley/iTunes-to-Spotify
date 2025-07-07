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
