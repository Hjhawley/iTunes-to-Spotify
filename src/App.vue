<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from "vue";
import { Browser } from '@capacitor/browser'; // Updated import
import { Capacitor } from '@capacitor/core';

const defaultAvatar = new URL("./assets/pic.jpg", import.meta.url).href;
console.log("defaultAvatar →", defaultAvatar);

const user = ref(null);
const file = ref(null); // the uploaded XML
const fileInput = ref(null); // so we can reupload files
const uris = ref([]); // holds the array of track objects
const status = ref([]); // messages about how many tracks found or errors
const log = ref(null); // the DOM element reference of the status log
const logEntries = ref([]); // array of { text?: string; pic?: string; score?: number }
const playlistName = ref("");
const showModal = ref(false);

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
console.log("Debug: BACKEND_URL =", BACKEND_URL);
console.log("VITE_BACKEND_URL from env:", import.meta.env.VITE_BACKEND_URL);

// Redirect to backend login using Browser
async function loginWithSpotify() {
  try {
    const redirectUri = Capacitor.isNativePlatform() ? 'itunestospotify://callback' : `${BACKEND_URL}/auth/callback`;
    console.log("Opening URL:", `${BACKEND_URL}/auth/login?redirect_uri=${encodeURIComponent(redirectUri)}`);
    await Browser.open({
      url: `${BACKEND_URL}/auth/login?redirect_uri=${encodeURIComponent(redirectUri)}`,
    });

    // Listen for page loaded event
    const pageLoadedListener = await Browser.addListener('browserPageLoaded', () => {
      console.log("Page loaded");
    });

    // Listen for browser finished event (closed by user)
    const finishedListener = await Browser.addListener('browserFinished', async () => {
      console.log("Browser was closed by user");
      status.value = ["Login cancelled"];
      pageLoadedListener.remove();
      finishedListener.remove();

      // Check if login was successful after closure
      try {
        const whoamiRes = await fetch(`${BACKEND_URL}/auth/whoami`, {
          credentials: "include",
        });
        user.value = whoamiRes.ok ? await whoamiRes.json() : null;
        if (user.value) {
          status.value = ["Login successful"];
        }
      } catch (err) {
        console.error("Error checking session:", err);
        status.value = ["Login failed"];
      }
    });
  } catch (err) {
    console.error("Error opening Browser:", err);
    status.value = [`Error opening browser: ${err.message}`];
  }
}

// Redirect to backend logout
function logoutWithSpotify() {
  window.location.href = `${BACKEND_URL}/auth/logout`;
}

// Open/close modal
function openPlaylistModal() {
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
}

// Check session on mount
onMounted(async () => {
  try {
    const res = await fetch(`${BACKEND_URL}/auth/whoami`, {
      credentials: "include",
    });
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
    const res = await fetch(`${BACKEND_URL}/import/import`, {
      method: "POST",
      body: form,
      credentials: "include",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.tracks && data.name) {
      uris.value = data.tracks;
      playlistName.value = data.name || "iTunes Playlist";
    } else {
      status.value = [data.error || "Failed to load tracks"];
    }
  } catch (err) {
    console.error(err);
    status.value = [`Error: ${err.message}`];
  }
}

function reset() {
  playlistName.value = "";
  uris.value = [];
  file.value = null;
  if (fileInput.value) fileInput.value.value = "";
}

async function onSubmit() {
  if (!file.value || !user.value) return;

  logEntries.value = [{ text: "Starting import…" }];

  let matchCount = 0;
  let totalCount = 0;

  const form = new FormData();
  form.append("file", file.value);

  const res = await fetch(`${BACKEND_URL}/import/import-stream`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
  if (!res.ok) {
    logEntries.value.push({
      text: `HTTP ${res.status} - could not start import.`,
    });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop();

    for (const chunk of parts) {
      if (!chunk.startsWith("data:")) continue;
      const entry = JSON.parse(chunk.replace(/^data:\s*/, ""));

      if (entry.text?.startsWith("Parsed ")) {
        const m = entry.text.match(/^Parsed\s+(\d+)\s+tracks/);
        if (m) totalCount = parseInt(m[1], 10);
      }

      if (entry.score != null) {
        matchCount++;
      }

      if (entry.text === "Playlist successfully migrated!") {
        const pct = totalCount > 0 ? Math.round((matchCount / totalCount) * 100) : 0;
        entry.text += ` ${pct}% success rate.`;
      }

      logEntries.value.push(entry);

      if (entry.text?.startsWith("Playlist successfully migrated")) {
        setTimeout(() => {
          reset();
        }, 100);
      }
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
  if (text.startsWith("Playlist successfully migrated")) return "log-success";
  return "";
}

window.onscroll = function () {
  myFunction();
};

function myFunction() {
  const modalBody = document.querySelector(".modal-body");
  const progressBar = document.getElementById("myBar");
  if (!modalBody || !progressBar) return;

  const scrollTop = modalBody.scrollTop;
  const scrollHeight = modalBody.scrollHeight - modalBody.clientHeight;
  const scrolled = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
  progressBar.style.width = scrolled + "%";
}

watch(showModal, (val) => {
  if (val) {
    nextTick(() => {
      const modalBody = document.querySelector(".modal-body");
      if (modalBody) {
        modalBody.addEventListener("scroll", myFunction);
        myFunction();
      }
    });
  } else {
    const modalBody = document.querySelector(".modal-body");
    if (modalBody) {
      modalBody.removeEventListener("scroll", myFunction);
    }
    const progressBar = document.getElementById("myBar");
    if (progressBar) progressBar.style.width = "0%";
  }
});

watch(
  () => logEntries.value.length,
  async () => {
    await nextTick();
    if (log.value) log.value.scrollTop = log.value.scrollHeight;
  }
);

onUnmounted(() => {
  Browser.removeAllListeners(); // Updated to Browser
});
</script>

<template>
  <div class="container" :class="{ centered: !user }">
    <div class="main-content">
      <h1>iTunes >> Spotify<br />Playlist Migrator</h1>

      <div v-if="!user">
        <button @click="loginWithSpotify" :disabled="status.length > 0">
          {{ status.length > 0 ? status[0] : "Log in with Spotify" }}
        </button>
      </div>

      <div v-else class="user-info">
        <a href="https://open.spotify.com/" target="_blank" rel="noopener">
          <img
            :src="user.images?.[0]?.url || defaultAvatar"
            alt="User avatar"
          />
        </a>
        <p>Logged in as {{ user.display_name }}</p>
        <button @click="logoutWithSpotify">Log out of Spotify</button>

        <div class="upload-section">
          <p>Upload your iTunes XML playlist:</p>
          <div class="file-wrapper">
            <input
              ref="fileInput"
              id="file-input"
              type="file"
              accept=".xml,text/xml"
              @change="onFileSelect"
            />
          </div>
          <p class="file-name" v-if="file">{{ file.name }}</p>
        </div>
        <div>
          <button v-if="file" @click="openPlaylistModal">
            Preview playlist
          </button>
          <button v-if="file" @click="onSubmit">Migrate playlist</button>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ playlistName || "Playlist Preview" }}</h2>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <div class="progress-container">
          <div class="progress-bar" id="myBar"></div>
        </div>
        <div class="modal-body">
          <div v-if="!uris.length" class="loader"></div>
          <div v-else class="track-list">
            <div v-for="(track, index) in uris" :key="index" class="track-item">
              <div style="flex: 1; display: flex; flex-direction: row; gap: 10px">
                <img
                  :src="track.pic"
                  class="track-pic"
                  style="border-radius: 10%"
                />
                <div class="track-info">
                  <strong>{{ track.name || "Unknown Track" }}</strong>
                  <span class="artist">{{ track.artist || "Unknown Artist" }}</span>
                  <span class="album" v-if="track.album">{{ track.album }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="status-log" v-if="user" ref="log">
      <div v-for="(entry, i) in logEntries" :key="i" class="log-entry">
        <img
          v-if="entry.pic"
          :src="entry.pic"
          alt="album art"
          class="log-image"
        />
        <template v-if="isPlaylistCreated(entry.text)">
          <span>
            Playlist created (ID:
            <a
              :href="`https://open.spotify.com/playlist/${extractPlaylistId(entry.text)}`"
              target="_blank"
              rel="noopener"
            >
              {{ extractPlaylistId(entry.text) }}</a
            >)
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
      </div>
    </div>
  </div>

  <footer>
    This web app is not affiliated with Apple or Spotify.<br />
    <a
      href="https://github.com/Hjhawley/iTunes-to-Spotify"
      target="_blank"
      rel="noopener"
      >github.com/Hjhawley/iTunes-to-Spotify</a
    >
  </footer>
</template>