// cleaner functions
import { cleanTrack, cleanAlbum, cleanArtist } from './cleaners'
import { compareTwoStrings } from 'string-similarity'

const API = 'https://api.spotify.com/v1'

/**
 * Search for a track and return the best match URI, or null.
 */
export async function findBestTrack(token, { artist, name, album, trackNumber }) {
  const q1 = `track:${cleanTrack(name)} artist:${artist} album:${cleanAlbum(album)}`
  let items = await search(token, q1)

  if (!items.length) {
    // fallback: clean artist
    const artist2 = cleanArtist(artist)
    items = await search(token, `track:${cleanTrack(name)} artist:${artist2}`)
  }
  if (!items.length) {
    // fallback: grab album then pick by trackNumber
    const albums = await searchAlbums(token, artist, cleanAlbum(album))
    if (albums.length) {
      const tracks = await fetchAlbumTracks(token, albums[0].id)
      return tracks[ trackNumber - 1 ]?.uri || null
    }
  }

  // fuzzy‐match among results
  if (items.length) {
    const query = `${artist} ${cleanTrack(name)}`.toLowerCase()
    let best = -1;
    let bestScore = 0;
    items.forEach(t => {
      const text = `${t.artists[0].name} ${t.name}`.toLowerCase();
      const score = compareTwoStrings(query, text) * 100;
      if (score > bestScore || (score === bestScore && t.popularity > best.popularity)) {
        best = t; bestScore = score
      }
    })
    return best?.uri || null
  }
  return null
}

// lower‐level helpers
async function search(token, q) {
  const res = await fetch(`${API}/search?type=track&q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  return (await res.json()).tracks.items
}

async function searchAlbums(token, artist, album) {
  const res = await fetch(`${API}/search?type=album&q=${encodeURIComponent(`artist:${artist} album:${album}`)}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  return (await res.json()).albums.items
}

async function fetchAlbumTracks(token, albumId) {
  const res = await fetch(`${API}/albums/${albumId}/tracks`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  return (await res.json()).items
}

/**
 * Create a new playlist for the current user.
 */
export async function createPlaylist(token, userId, name) {
  const res = await fetch(`${API}/users/${userId}/playlists`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name })
  })
  return (await res.json()).id
}

/**
 * Add an array of track URIs to a playlist.
 */
export async function addTracks(token, playlistId, uris) {
  await fetch(`${API}/playlists/${playlistId}/tracks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ uris })
  })
}

/**
 * High-level: given your parsed tracksInfo and playlistOrder,
 * creates a Spotify playlist and adds each matching track.
 */
export async function migratePlaylist(
  token, userId, playlistName, playlistOrder, tracksInfo
) {
  const playlistId = await createPlaylist(token, userId, playlistName)
  for (const trackId of playlistOrder) {
    const info = tracksInfo[trackId]
    if (!info) continue
    const uri = await findBestTrack(token, info)
    if (uri) {
      await addTracks(token, playlistId, [uri])
      console.log(`Added ${info.artist} - ${info.name}`)
    } else {
      console.warn(`Could not find: ${info.artist} - ${info.name}`)
    }
  }
  return playlistId
}
