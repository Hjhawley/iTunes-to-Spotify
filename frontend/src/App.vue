<script setup>
import { ref, watch, nextTick, onMounted } from "vue";

const user = ref(null);
const file = ref(null);       // the uploaded XML
const uris = ref([]);         // holds the array of track objects
const status = ref([]);       // optional: messages about how many tracks found or errors
const log = ref(null);        // the DOM element reference of the status log
const logEntries = ref([]);   // array of { text?: string; pic?: string }

// Backend base URL
const BACKEND_URL = "http://localhost:8888";

// Redirect to backend login
function loginWithSpotify() {
  window.location.href = `${BACKEND_URL}/auth/login`;
}
// Redirect to backend logout
function logoutWithSpotify() {
  window.location.href = `${BACKEND_URL}/auth/logout`;
}

// Check session on mount
onMounted(async () => {
  try {
    const res = await fetch(`${BACKEND_URL}/auth/whoami`, { credentials: "include" });
    user.value = res.ok ? await res.json() : null;
  } catch {
    user.value = null;
  }
});

// Handle file select & preview fetch
async function onFileSelect(event) {
  const chosen = event.target.files?.[0];
  if (!chosen || !chosen.name.toLowerCase().endsWith(".xml")) {
    alert("Please choose an iTunes XML file.");
    event.target.value = "";
    file.value = null;
    return;
  }
  file.value = chosen;
  const form = new FormData();
  form.append("file", chosen);

  try {
    const res = await fetch(`${BACKEND_URL}/songs`, { method: "POST", body: form, credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data)) {
      uris.value = data;
      status.value = [`Found ${data.length} tracks`];
    } else {
      status.value = [data.error || "Failed to load tracks"];
    }
  } catch (err) {
    console.error(err);
    status.value = [`Error: ${err.message}`];
  }
}

// Perform import, build a logEntries array
async function onSubmit() {
  if (!file.value || !user.value) return;
  const form = new FormData();
  form.append("file", file.value);

  logEntries.value.push({ text: "Uploading…" });
  const res = await fetch(`${BACKEND_URL}/import`, { method: "POST", body: form, credentials: "include" });
  const logs = await res.json();

  if (Array.isArray(logs)) {
    logs.forEach(raw => {
      logEntries.value.push({ text: raw.text, pic: raw.pic, score: raw.score });
    });
  } else {
    logEntries.value.push({ text: logs.error || "Migration failed." });
  }
}

// Helpers for log rendering
const playlistRe = /Playlist created \(ID: (\w+)\)/;
function isPlaylistCreated(text) {
  return playlistRe.test(text);
}
function extractPlaylistId(text) {
  const m = text.match(playlistRe);
  return m ? m[1] : null;
}
function logClass(text) {
  if (text.startsWith("Error:") || text === "No match found.") return 'log-error';
  if (text.startsWith("Tracks successfully added!")) return 'log-success';
  return '';
}

// Auto scroll
watch(
  () => logEntries.value.length,
  async () => {
    await nextTick();
    if (log.value) log.value.scrollTop = log.value.scrollHeight;
  }
);
</script>

<template>
  <div class="container">
    <!-- main-content: login and buttons -->
    <div class="main-content">
      <h1>iTunes &gt;&gt; Spotify<br>Playlist Migrator</h1>

      <div v-if="!user">
        <button @click="loginWithSpotify">Login with Spotify</button>
      </div>

      <!-- once logged in -->
      <div v-else class="user-info">
        <img v-if="user.images?.length" :src="user.images[0].url">
        <p>Logged in as {{ user.display_name }}</p>
        <button @click="logoutWithSpotify">Log out</button>

        <div class="upload-section">
          <p>Upload your iTunes XML playlist:</p>
          <div class="file-wrapper">
            <input id="file-input" type="file" accept=".xml,text/xml" @change="onFileSelect">
          </div>
          <p class="file-name" v-if="file">{{ file.name }}</p>
        </div>

        <button v-if="file" @click="onSubmit">Migrate playlist</button>
      </div>
    </div>

      <div class="status-log" v-if="user" ref="log">
        <div v-for="(entry, i) in logEntries" :key="i" class="log-entry">
          <template v-if="isPlaylistCreated(entry.text)">
            <span>
              Playlist created (ID:
              <a :href="`https://open.spotify.com/playlist/${extractPlaylistId(entry.text)}`" target="_blank" rel="noopener">
                {{ extractPlaylistId(entry.text) }}
              </a>)
            </span>
          </template>
          <template v-else>
            <span :class="logClass(entry.text)">
              {{ entry.text }}
              <template v-if="entry.score != null">
                ({{ entry.score }}%)
              </template>
            </span>
          </template>
          <img v-if="entry.pic" :src="entry.pic" alt="album art" class="log-image">
        </div>
      </div>
    </div>

    <footer>
      This web app is not affiliated with Apple or Spotify.<br>
      <a href="https://github.com/Hjhawley/iTunes-to-Spotify" target="_blank" rel="noopener">github.com/Hjhawley/iTunes-to-Spotify</a>
    </footer>

</template>
