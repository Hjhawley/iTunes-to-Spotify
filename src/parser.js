/**
 * Extracts every track entry from the iTunes XML and returns:
 *   { [trackId]: { name, artist, album, trackNumber } }
 */
export function parseTracks(xmlDoc) {
  const result = {}
  const rootDict = xmlDoc.querySelector('plist > dict')
  const children = Array.from(rootDict.children)

  for (let i = 0; i < children.length; i++) {
    if (children[i].tagName === 'key' && children[i].textContent === 'Tracks') {
      const tracksDict = children[i + 1]
      const pairs = Array.from(tracksDict.children)
      for (let j = 0; j < pairs.length; j += 2) {
        const id = Number(pairs[j].textContent)
        const info = Array.from(pairs[j + 1].children)
        const entry = {}
        for (let k = 0; k < info.length; k += 2) {
          entry[ info[k].textContent ] = info[k + 1].textContent
        }
        result[id] = {
          name:        entry.Name,
          artist:      entry.Artist,
          album:       entry.Album,
          trackNumber: Number(entry['Track Number']),
        }
      }
      break
    }
  }
  return result
}


/**
 * Returns an array of track IDs in the order they appear
 * in the first (or named) playlist.
 */
export function parsePlaylistOrder(xmlDoc, playlistName = null) {
  const rootDict = xmlDoc.querySelector('plist > dict');
  const children = Array.from(rootDict.children);

  for (let i = 0; i < children.length; i++) {
    if (children[i].tagName === 'key' && children[i].textContent === 'Playlists') {
      const playlistsArray = children[i + 1]; // <array>
      const playlists = Array.from(playlistsArray.children).filter(el => el.tagName === 'dict');

      // Find the right playlist
      let targetPlaylist = null;

      for (const dict of playlists) {
        const kids = Array.from(dict.children);
        for (let j = 0; j < kids.length - 1; j++) {
          if (
            kids[j].tagName === 'key' &&
            kids[j].textContent === 'Name' &&
            (!playlistName || kids[j + 1].textContent === playlistName)
          ) {
            targetPlaylist = dict;
            break;
          }
        }
        if (targetPlaylist) break;
      }

      // Fallback to the first one if no match
      if (!targetPlaylist && playlists.length > 0) {
        targetPlaylist = playlists[0];
      }

      if (!targetPlaylist) return [];

      // Extract Playlist Items → Track IDs
      const targetChildren = Array.from(targetPlaylist.children);
      for (let k = 0; k < targetChildren.length - 1; k++) {
        if (
          targetChildren[k].tagName === 'key' &&
          targetChildren[k].textContent === 'Playlist Items'
        ) {
          const itemsArray = targetChildren[k + 1]; // <array>
          const items = Array.from(itemsArray.children).filter(el => el.tagName === 'dict');
          const ids = [];

          for (const itemDict of items) {
            const itemChildren = Array.from(itemDict.children);
            for (let m = 0; m < itemChildren.length - 1; m++) {
              if (
                itemChildren[m].tagName === 'key' &&
                itemChildren[m].textContent === 'Track ID' &&
                itemChildren[m + 1].tagName === 'integer'
              ) {
                ids.push(Number(itemChildren[m + 1].textContent));
              }
            }
          }

          return ids;
        }
      }
    }
  }

  return [];
}