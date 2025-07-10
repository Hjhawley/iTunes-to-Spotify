<script setup>
import { ref, watch, nextTick, onMounted } from "vue";

const user = ref(null);
const file = ref(null);       // the uploaded XML
const log = ref(null);        // the DOM element reference of the status log
const logMessages = ref([]);  // array of log messages (strings)
const status = ref([]);
const uris = ref([]);

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
    if (!res.ok) {
      user.value = null;
      return;
    }
    user.value = await res.json();
  } catch {
    user.value = null;
  }
});

// File selection handler
async function onFileSelect(event) {
  const chosen = event.target.files?.[0];
  if (chosen && chosen.name.toLowerCase().endsWith(".xml")) {
    file.value = chosen;
    // Prepare form data for upload
    const form = new FormData();
    form.append("file", chosen);
    try {
      const res = await fetch(`${BACKEND_URL}/songs`, {
        method: "POST",
        body: form,
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const responseUris = await res.json();
      if (Array.isArray(responseUris)) {
        uris.value = responseUris; // Store the actual URIs array
        status.value.push(`Found ${responseUris.length} Spotify track URIs.`);
      } else {
        status.value.push(responseUris.error || "Failed to get URIs.");
      }
    } catch (err) {
      console.error("Upload error:", err);
      status.value.push(`Error uploading file: ${err.message}`);
    }
  } else {
    alert("Please choose an iTunes XML file.");
    event.target.value = "";
    file.value = null;
  }
}

// Submit XML to backend import endpoint
async function onSubmit() {
  if (!file.value || !user.value) return;
  const form = new FormData();
  form.append("file", file.value);
  logMessages.value.push("Uploading…");

  const res = await fetch(`${BACKEND_URL}/import`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
  const logs = await res.json();

  if (Array.isArray(logs)) {
    logMessages.value.push(...logs);
  } else {
    logMessages.value.push(logs.error || "Migration failed.");
  }
}

watch(
  () => logMessages.value.length, async () => {
    await nextTick();
    if (log.value) {
      log.value.scrollTop = log.value.scrollHeight;
    }
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

      <p>Upload your iTunes XML playlist:</p>
      <input type="file" accept=".xml,text/xml" @change="onFileSelect" />
      <p>Spotify URIs:</p>
      <ul>
        <li v-for="(track, idx) in uris" :key="idx" class="song_container">
          <div>
            <img
              :src="track.pic"
              alt="Track image"
              style="max-width: 100px; max-height: 100px"
            />
            <span>
              <p>{{ track.name }}</p>
              <p style="color: lightslategray">{{ track.artists }}</p>
            </span>
            <span style="margin-left: 5rem">
              {{ track.duration }}
            </span>
          </div>
        </li>
      </ul>
      <div v-if="file">
        <button @click="onSubmit">Migrate to Spotify</button>
        <div class="status-log">
          <p v-for="(msg, i) in status" :key="i">{{ msg }}</p>
        </div>

        <button v-if="file" @click="onSubmit">Migrate playlist</button>
      </div>
    </div>

      <!-- status log -->
      <div class="status-log" v-if="user" ref="log">
        <p v-for="(msg, i) in logMessages" :key="i">{{ msg }}</p>
      </div>
  </div>

  <!-- footer -->
  <footer>
    This web app is not affiliated with Apple or Spotify.<br/>
    Source code available at
    <a
      href="https://github.com/Hjhawley/iTunes-to-Spotify"
      target="_blank"
      rel="noopener"
    >github.com/Hjhawley/iTunes-to-Spotify</a>
  </footer>
</template>
