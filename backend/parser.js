function parsePlaylistName(xmlDoc) {
  const rootDict = xmlDoc.querySelector("plist > dict");
  const children = Array.from(rootDict.children);

  // Find <key>Playlists</key> followed by its <array>
  for (let i = 0; i < children.length - 1; i++) {
    if (
      children[i].tagName === "key" &&
      children[i].textContent === "Playlists" &&
      children[i + 1].tagName === "array"
    ) {
      const playlistArray = children[i + 1];
      const firstDict = Array.from(playlistArray.children).find(
        (el) => el.tagName === "dict"
      );

      if (!firstDict) return null;

      const elements = Array.from(firstDict.children);
      for (let j = 0; j < elements.length - 1; j++) {
        if (
          elements[j].tagName === "key" &&
          elements[j].textContent === "Name" &&
          elements[j + 1].tagName === "string"
        ) {
          return elements[j + 1].textContent;
        }
      }
    }
  }

  return null;
}

/* cleaner functions */
function cleanTrack(title) {
  // Remove naughty phrases
  title = title.replace(
    /\s*[\(\[]?\s*(?:LP Version|Single Version|Mono Version|Stereo Version|Remastered Version|Remaster)\s*[\)\]]?\s*/gi,
    ""
  );
  // Remove ’ ' , . ! ? [] ()
  title = title.replace(/[’',.!?\[\]\(\)]/g, "");
  // turn slashes and dashes into spaces
  title = title.replace(/[\/\-]/g, " ");
  // trim leading/trailing spaces
  title = title.trim();
  // Collapse multiple spaces into one
  title = title.replace(/\s+/g, " ");
  // Strip leading "The "
  title = title.replace(/^The\s+/i, "");
  // Convert "&" to "and"
  title = title.replace(/&/g, "and");
  return title;
}

function cleanAlbum(album) {
  album = album.replace(/\b(remastered|deluxe|edition|version)\b/gi, ""); // Drop naughty words
  album = cleanTrack(album);
  return album;
}

function cleanArtist(name) {
  // edge case
  if (name === "The The") return name;
  // Strip leading "The "
  name = name.replace(/^The\s+/i, "");
  // Convert "&" to "and"
  name = name.replace(/&/g, "and");
  return name;
}

function parseTracks(xmlDoc) {
  const result = {};
  const rootDict = xmlDoc.querySelector("plist > dict");
  const rootElements = Array.from(rootDict.children);

  // find the 'tracks' section
  for (let i = 0; i < rootElements.length; i++) {
    const node = rootElements[i];
    if (node.tagName === "key" && node.textContent === "Tracks") {
      const tracksDict = rootElements[i + 1];
      const pairs = Array.from(tracksDict.children);
      for (let j = 0; j < pairs.length; j += 2) {
        const id = Number(pairs[j].textContent);
        const info = Array.from(pairs[j + 1].children);
        const entry = {};
        for (let k = 0; k < info.length; k += 2) {
          const propName = info[k].textContent; // "Name", "Artist"
          const propValue = info[k + 1].textContent;
          entry[propName] = propValue;
        }
        result[id] = {
          name: cleanTrack(entry.Name || ""),
          artist: cleanArtist(entry.Artist || ""),
          album: cleanAlbum(entry.Album || ""),
          trackNumber: Number(entry["Track Number"] || 0),
        };
      }
      break;
    }
  }
  return result;
}

function parsePlaylistOrder(xmlDoc, playlistName = null) {
  const rootDict = xmlDoc.querySelector("plist > dict");
  const rootElements = Array.from(rootDict.children);

  // find the 'playlists' section
  for (let i = 0; i < rootElements.length; i++) {
    const node = rootElements[i];
    if (node.tagName === "key" && node.textContent === "Playlists") {
      const playlistsArray = rootElements[i + 1];
      const playlists = Array.from(playlistsArray.children).filter(
        (element) => element.tagName === "dict"
      );

      // find the target playlist by name, or default to the first one
      let targetPlaylist = null;
      for (const dict of playlists) {
        const playlistElements = Array.from(dict.children);
        for (let j = 0; j < playlistElements.length - 1; j++) {
          if (
            playlistElements[j].tagName === "key" &&
            playlistElements[j].textContent === "Name" &&
            (!playlistName ||
              playlistElements[j + 1].textContent === playlistName)
          ) {
            targetPlaylist = dict;
            break;
          }
        }
        if (targetPlaylist) break;
      }
      if (!targetPlaylist && playlists.length > 0) {
        targetPlaylist = playlists[0];
      }
      if (!targetPlaylist) return [];

      // within the seletced playlist dict find the 'playlist items' key
      const playlistChildren = Array.from(targetPlaylist.children);
      for (let k = 0; k < playlistChildren.length - 1; k++) {
        const child = playlistChildren[k];
        if (child.tagName === "key" && child.textContent === "Playlist Items") {
          // next sibling is an array of item dicts
          const itemsArray = playlistChildren[k + 1];
          const items = Array.from(itemsArray.children).filter(
            (el) => el.tagName === "dict"
          );
          const ids = [];

          // Each item dict holds a Track ID entry
          for (const itemDict of items) {
            const itemChildren = Array.from(itemDict.children);
            for (let m = 0; m < itemChildren.length - 1; m++) {
              if (
                itemChildren[m].tagName === "key" &&
                itemChildren[m].textContent === "Track ID" &&
                itemChildren[m + 1].tagName === "integer"
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
  // if no playlists found, return an empty array
  return [];
}

module.exports = {
  parsePlaylistName,
  cleanTrack,
  cleanAlbum,
  cleanArtist,
  parseTracks,
  parsePlaylistOrder,
};
