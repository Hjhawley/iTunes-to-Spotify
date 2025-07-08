const { cleanTrack, cleanAlbum, cleanArtist } = require('./parser');
const { compareTwoStrings } = require('string-similarity');
const fetch = require('node-fetch');
const API = 'https://api.spotify.com/v1';

/* Search for a track and return the best match URI, or null. */
async function findBestTrack(token, { artist, name, album, trackNumber }) {
  const q1 = `track:${cleanTrack(name)} artist:${artist} album:${cleanAlbum(album)}`;
  let items = await _search(token, q1);

  if (!items.length) {
    const artist2 = cleanArtist(artist);
    items = await _search(token, `track:${cleanTrack(name)} artist:${artist2}`);
  }

  if (!items.length) {
    const albums = await _searchAlbums(token, artist, cleanAlbum(album));
    if (albums.length) {
      const tracks = await _fetchAlbumTracks(token, albums[0].id);
      return tracks[trackNumber - 1]?.uri ?? null;
    }
  }

  if (items.length) {
    const query = `${artist} ${cleanTrack(name)}`.toLowerCase();
    let best = null;
    let bestScore = 0;
    for (const t of items) {
      const text = `${t.artists[0].name} ${t.name}`.toLowerCase();
      const score = compareTwoStrings(query, text) * 100;
      if (score > bestScore || (score === bestScore && t.popularity > best.popularity)) {
        best = t;
        bestScore = score;
      }
    }
    return best?.uri ?? null;
  }

  return null;
}

async function _search(token, q) {
  const res = await fetch(`${API}/search?type=track&q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await res.json();
  return body.tracks?.items ?? [];
}

async function _searchAlbums(token, artist, album) {
  const res = await fetch(
    `${API}/search?type=album&q=${encodeURIComponent(`artist:${artist} album:${album}`)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const body = await res.json();
  return body.albums?.items ?? [];
}

async function _fetchAlbumTracks(token, albumId) {
  const res = await fetch(`${API}/albums/${albumId}/tracks`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await res.json();
  return body.items ?? [];
}

/* Create a new playlist for the current user. */
async function createPlaylist(token, name) {
  const res = await fetch(`${API}/me/playlists`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      public: false, // private by default? probably
      description: ''
    })
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error?.message || 'Failed to create playlist');
  }
  return body.id;
}

/* Add an array of track URIs to a playlist. */
async function addTracks(token, playlistId, uris) {
  const res = await fetch(`${API}/playlists/${playlistId}/tracks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ uris })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to add tracks');
  }
}

module.exports = {
  findBestTrack,
  createPlaylist,
  addTracks
};
