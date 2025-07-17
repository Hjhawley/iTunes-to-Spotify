<script setup>
import { ref, watch, nextTick, onMounted } from "vue";

const user = ref(null);
const file = ref(null);       // the uploaded XML
const uris = ref([]);         // holds the array of track objects (unused in SSE flow)
const status = ref([]);       // optional: messages about how many tracks found or errors
const log = ref(null);        // the DOM element reference of the status log
const logEntries = ref([]);   // array of { text?: string; pic?: string; score?: number }

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

async function onSubmit() {
  if (!file.value || !user.value) return;

  logEntries.value = [{ text: "Starting import…" }];

  let matchCount = 0;
  let totalCount = 0;

  const form = new FormData();
  form.append("file", file.value);

  const res = await fetch(`${BACKEND_URL}/import-stream`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
  if (!res.ok) {
    logEntries.value.push({ text: `HTTP ${res.status} - could not start import.` });
    return;
  }

  // Read the body as a stream
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    // SSE frames are delimited by "\n\n"
    const parts = buf.split("\n\n");
    buf = parts.pop(); // leftover for next chunk

    for (const chunk of parts) {
      if (!chunk.startsWith("data:")) continue;
      const entry = JSON.parse(chunk.replace(/^data:\s*/, ""));

      // capture original playlist size
      if (entry.text?.startsWith("Parsed ")) {
        const m = entry.text.match(/^Parsed\s+(\d+)\s+tracks/);
        if (m) totalCount = parseInt(m[1], 10);
      }

      // count successful matches
      if (entry.score != null) {
        matchCount++;
}

      // append percentage on final message
      if (entry.text === "Playlist successfully migrated!") {
        const pct = totalCount > 0
          ? Math.round((matchCount / totalCount) * 100)
          : 0;
        entry.text += ` ${pct}% success rate.`;
      }

      logEntries.value.push(entry);
    }
  }
}

const playlistRe = /Playlist created \(ID: (\w+)\)/;
function isPlaylistCreated(text) {
  return playlistRe.test(text);
}
function extractPlaylistId(text) {
  const m = text.match(playlistRe);
  return m ? m[1] : null;
}
function logClass(text) {
  if (text.startsWith("Error:") || text.startsWith("No match")) return "log-error";
  if (text.startsWith("Playlist successfully migrated!")) return "log-success";
  return "";
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
  <div class="container" :class="{ centered: !user }">
    <!-- main-content: login and buttons -->
    <div class="main-content">
      <h1>
        <span class="glow-text">iTunes Spotify<br>Playlist Migrator</span>
      </h1>
      <template v-if="!user">
        <div>
          <button @click="loginWithSpotify">Login with Spotify</button>
        </div>
      </template>
      <template v-else>
        <div class="user-info">
          <img v-if="user.images?.length" :src="user.images[0].url" alt="User avatar">
          <p>Logged in as {{ user.display_name }}</p>
          <button @click="logoutWithSpotify">Log out of Spotify</button>

          <div class="upload-section">
            <p>Upload your iTunes XML playlist:</p>
            <div class="file-wrapper">
              <input id="file-input" type="file" accept=".xml,text/xml" @change="onFileSelect">
            </div>
            <p class="file-name" v-if="file">{{ file.name }}</p>
          </div>

          <button v-if="file" @click="onSubmit">Migrate playlist</button>
        </div>
      </template>

<!-- Box container example -->
<div class="box-container">
  <div class="box">
    <h2 class="box-title">Your Box Title</h2>
    <div class="box-content">
      <!-- Add your content here -->
      <p>This is a box container. Place any content you want inside.</p>
    </div>
  </div>
</div>
    </div>

    <!-- status log -->
      <div class="status-log" v-if="user" ref="log">
        <div v-for="(entry, i) in logEntries" :key="i" class="log-entry">
        <img v-if="entry.pic" :src="entry.pic" alt="album art" class="log-image">
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
            <img v-if="entry.pic" :src="entry.pic" alt="album art" class="log-image">
          </template>
        </div>
      </div>
    </div>

    <footer>
      This web app is not affiliated with Apple or Spotify.<br>
      <a href="https://github.com/Hjhawley/iTunes-to-Spotify" target="_blank" rel="noopener">github.com/Hjhawley/iTunes-to-Spotify</a>
    </footer>
</template>
