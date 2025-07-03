<script setup>
import { ref, onMounted } from 'vue'

// xml parsing
import { parseTracks, parsePlaylistOrder } from './parser'
// spotify API handling
import { migratePlaylist } from './spotify'
// import spotify OAuth info
const {
  VITE_SPOTIFY_SCOPE: SCOPE,
  VITE_SPOTIFY_CLIENT_ID: CLIENT_ID,
  VITE_SPOTIFY_REDIRECT_URI: REDIRECT_URI
} = import.meta.env // user needs to supply their own info

const token = ref(null); // the OAuth token
const user = ref(null); // the user profile object

function loginWithSpotify() {
  const params = new URLSearchParams({
    response_type: 'token',
    scope: SCOPE, // playlist-modify-public
    client_id: CLIENT_ID, // the app's client id
    redirect_uri: REDIRECT_URI // http://localhost:5173/callback for Vite
  })
  // authenticate
  window.location.href = "https://accounts.spotify.com/authorize?"+params;
}

onMounted(async () => {
  // grab the URL after the #
  const hash = new URLSearchParams(window.location.hash.slice(1))
  if (hash.has('access_token')) {
    // store the token
    token.value = hash.get('access_token');
    // clean up URL
    window.history.replaceState({}, null, window.location.pathname);
    // fetch Spotify user profile
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: 'Bearer '+token.value }
    })
      user.value = await response.json();
    } catch (err) {
      console.error(err)
      alert('Could not load your profile. Try logging in again.')
      token.value = null
    }
      
  }
})

const file = ref(null);
const status = ref([])

// Handle the file‐picker’s change event
function onFileSelect(event) {
  const chosen = event.target.files?.[0];
  if (chosen && chosen.name.toLowerCase().endsWith('.xml')) {
    file.value = chosen;
    console.log('XML file selected:', chosen);
  } else {
    alert('Please choose an XML file. Get one by exporting your playlist from iTunes');
    event.target.value = '';
    file.value = null;
  }
}

async function onSubmit() {
  if (!file.value || !token.value) return
  const xml = await file.value.text()
  const xmlDoc = new DOMParser().parseFromString(xml, 'application/xml')

  // parse
  const tracksInfo    = parseTracks(xmlDoc)
  const playlistOrder = parsePlaylistOrder(xmlDoc)

  // migrate
  const playlistName = file.value.name.replace(/\.xml$/i, '')
  status.value.push(`Migrating “${playlistName}” to Spotify…`)
  await migratePlaylist(
    token.value,
    user.value.id,
    playlistName,
    playlistOrder,
    tracksInfo
  )
  status.value.push('Done!')
}
</script>

<template>
  <div class="container">

    <h1>iTunes >> Spotify
    <br>Playlist Migrator</h1>

    <div v-if="!token"> <!-- prompt login if not logged in -->
      <button @click="loginWithSpotify">
        Login with Spotify
      </button>
    </div>

    <div v-else> <!-- only show this stuff after the user is logged in -->

      <div class="user-info">
        <img v-if="user && user.images?.length" :src="user.images[0].url" />
        <p>Logged in as {{ user.display_name }}</p>
      </div>

      <div>
        <p>Upload an iTunes XML playlist:</p>
        <input
          type="file"
          id="itunes-file"
          accept=".xml,text/xml,application/xml"
          @change="onFileSelect"
        />

      <div v-if="file">
        <button @click="onSubmit" :disabled="!file || !token">
          Migrate to Spotify
        </button>
        <p v-for="(msg,i) in status" :key="i">{{ msg }}</p>
      </div>
    </div>

    </div>
  </div>
</template>

<style scoped>
.container {
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(to right, #103, #143);
}

button {
  margin: 16px;
  padding: 8px 24px;
  font-size: 1.25rem;
  border-radius: 24px;
  background: linear-gradient(to right, #70f, #1cc);
  color: white;
  border: none;
  cursor: pointer;
  box-shadow: 2px 4px 10px rgba(0, 0, 0, 0.7);
  transition: 0.1s;
}

button:hover {
  background: linear-gradient(to right, #a5f, #5cc);
}

div {
  display: flex;
  flex-direction: column;
  align-items: center;
}

input{
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

img {
  width: 128px;
  height: 128px;
  border-radius: 25%;
  box-shadow: 2px 4px 10px rgba(0, 0, 0, 0.7);
}

.choose-file-box {
  margin-top: 2rem;
  width: 512px;
  text-align: center;
}

.drop-zone {
  border: 2px solid #aaa;
  padding: 2rem;
  border-radius: 8px;
  cursor: pointer;
  background: rgba(255,255,255,0.05);
  transition: 0.1s;
}

.drop-zone:hover {
  background: rgba(255,255,255,0.1);
}

.browse {
  color: #1cc;
  text-decoration: underline;
  cursor: pointer;
}
</style>