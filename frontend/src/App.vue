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
    const res = await fetch(`${BACKEND_URL}/auth/whoami`, {
      credentials: "include",
    });
    if (res.ok) user.value = await res.json();
    else user.value = null;
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
    const res = await fetch(`${BACKEND_URL}/songs`, {
      method: "POST",
      body: form,
      credentials: "include",
    });
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

  const res = await fetch(`${BACKEND_URL}/import`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
  const logs = await res.json();

  if (Array.isArray(logs)) {
    let lastSearch = null;

    logs.forEach(raw => {
      const entry = { text: raw };

      // Capture the "artist" string
      if (raw.startsWith("Searching Spotify for")) {
        const m = raw.match(/"(.+)"/);
        if (m) lastSearch = m[1];
      }

      // Attach the pic for lastSearch
      if (raw === "Matched!" && lastSearch) {
        const match = uris.value.find(t => {
          const artists = Array.isArray(t.artists)
            ? t.artists.join(", ")
            : t.artists;
          return `${artists} - ${t.name}` === lastSearch;
        });
        if (match?.pic) {
          entry.pic = match.pic;
        }
      }

      logEntries.value.push(entry);
    });
  } else {
    logEntries.value.push({
      text: logs.error || "Migration failed."
    });
  }
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
      <h1>iTunes &gt;&gt; Spotify<br/>Playlist Migrator</h1>

      <!-- not yet authenticated -->
      <div v-if="!user">
        <button @click="loginWithSpotify">Login with Spotify</button>
      </div>

      <!-- once logged in -->
      <div v-else class="user-info">
        <img v-if="user.images?.length" :src="user.images[0].url" />
        <p>Logged in as {{ user.display_name }}</p>
        <button @click="logoutWithSpotify">Log out of Spotify</button>

        <div class="upload-section">
          <p>Upload your iTunes XML playlist:</p>
          <div class="file-wrapper">
            <input
              id="file-input"
              type="file"
              accept=".xml,text/xml"
              @change="onFileSelect"
            />
          </div>
          <p class="file-name" v-if="file">{{ file.name }}</p>
        </div>

        <button v-if="file" @click="onSubmit">Migrate playlist</button>
      </div>

      <!-- status log -->
      <div class="status-log" v-if="user" ref="log">
        <div v-for="(entry,i) in logEntries" :key="i" class="log-entry">
          <p v-if="entry.text">{{ entry.text }}</p>
          <img
            v-if="entry.pic"
            :src="entry.pic"
            alt="album art"
            class="log-image"
          />
        </div>
      </div>
    </div>

    <footer>
      This web app is not affiliated with Apple or Spotify.<br/>
      Source code available at
      <a
        href="https://github.com/Hjhawley/iTunes-to-Spotify"
        target="_blank"
        rel="noopener"
      >github.com/Hjhawley/iTunes-to-Spotify</a>
    </footer>
  </div>
</template>
