import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')

export function useSpotifyConfig() {
	const scope = import.meta.env.VITE_SPOTIFY_SCOPE;
	const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
	const secret = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET;
	const redirectTo = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

	return { scope, clientId, secret, redirectTo };
}

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