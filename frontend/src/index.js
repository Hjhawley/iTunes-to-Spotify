import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')

export function useSpotifyConfig() {
  const scope      = import.meta.env.VITE_SPOTIFY_SCOPE;
  const clientId   = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  const secret     = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET;
  const redirectTo = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

  return { scope, clientId, secret, redirectTo };
}