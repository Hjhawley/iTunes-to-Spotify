const { cleanTrack, cleanAlbum, cleanArtist } = require("./parser");
const { compareTwoStrings } = require("string-similarity");
/* const fetch = require("node-fetch"); // this might be breaking things */
const API = "https://api.spotify.com/v1";

/* Search for a track and return the best match URI, or null. */
async function findBestTrack(token, { artist, name, album }) {
  const cleanedTrack = cleanTrack(name);
  const cleanedArtist = cleanArtist(artist);
  const cleanedAlbum = cleanAlbum(album);

  // Plain‑text search of “[Artist] [Track] [Album]”
  let items = await _search(
    token,
    `${cleanedArtist} ${cleanedTrack} ${cleanedAlbum}`
  );

  // Fallback: try without the album
  if (!items.length) {
    items = await _search(token, `${cleanedArtist} ${cleanedTrack}`);
  }

  // Tie‑breaker
  if (items.length) {
    const query =
      `${cleanedArtist} ${cleanedTrack} ${cleanedAlbum}`.toLowerCase();
    let best = null,
      bestScore = 0;
    for (const t of items) {
      const candidate = `${cleanArtist(t.artists[0].name)} ${cleanTrack(
        t.name
      )} ${cleanAlbum(t.album.name)}`.toLowerCase();
      const score = compareTwoStrings(query, candidate) * 100;
      if (
        score > bestScore ||
        (score === bestScore && t.popularity > (best?.popularity || 0))
      ) {
        best = t;
        bestScore = score;
      }
    }
    return {
      uri: best?.uri ?? null,
      score: Math.round(bestScore),
    };
  }
  return { uri: null, score: 0 };
}

async function _search(token, q) {
  const res = await fetch(
    `${API}/search?type=track&q=${encodeURIComponent(q)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const body = await res.json();
  return body.tracks?.items ?? [];
}

async function getTrackById(token, id) {
  const res = await fetch(`${API}/tracks/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed fetching track details");
  return await res.json();
}

/* Create a new playlist for the current user. */
async function createPlaylist(token, name) {
  const res = await fetch(`${API}/me/playlists`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      public: false, // private by default? probably
      description: "",
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error?.message || "Failed to create playlist");
  }
  return body.id;
}

/* Add an array of track URIs to a playlist. */
async function addTracks(token, playlistId, uris) {
  const res = await fetch(`${API}/playlists/${playlistId}/tracks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uris }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to add tracks");
  }
}

module.exports = {
  findBestTrack,
  getTrackById,
  createPlaylist,
  addTracks,
};
