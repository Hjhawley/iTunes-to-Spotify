/**
 * Extracts every track entry from the iTunes XML and returns:
 * { [trackId]: { name, artist, album, trackNumber } }
 */
export function parseTracks(xmlDoc) {
	const result = {}; // a dict of songs
	const rootDict = xmlDoc.querySelector('plist > dict'); // help me understand what this does
	const children = Array.from(rootDict.children); // help me understand what this does

	// cleaner functions
	function cleanTrack(title) {
		return title
		.replace(/\(.*?\)/g, ' ')
		.replace(/[’']/g, ' ')
		.replace(/[\/\-]/g, ' ')
		.trim()
		.replace(/\s+/g, ' ');
	}

	function cleanAlbum(album) {
		return album
		.replace(/\b(remastered|deluxe)\b/gi, '')
		.replace(/\(.*?\)/g, ' ')
		.replace(/[’']/g, ' ')
		.replace(/[\/\-]/g, ' ')
		.trim()
		.replace(/\s+/g, ' ');
	}

	function cleanArtist(name) {
		if (name === 'The The') return name; // weird edge case
		return name
		.replace(/^The\s+/i, '')
		.replace(/&/g, 'and')
		.trim();
	}

	// find the <key>Tracks</key> section in the XML
	for (let i = 0; i < children.length; i++) {
		if (children[i].tagName === 'key' && children[i].textContent === 'Tracks') {
			const tracksDict = children[i + 1];
			const pairs = Array.from(tracksDict.children); // help me understand what this does

			for (let j = 0; j < pairs.length; j += 2) {
				const id = Number(pairs[j].textContent);
				const info = Array.from(pairs[j + 1].children);
				const entry = {};

				for (let k = 0; k < info.length; k += 2) {
					entry[ info[k].textContent ] = info[k + 1].textContent;
				}

				result[id] = {
					name: cleanTrack(entry.Name || ''),
					artist: cleanArtist(entry.Artist || ''),
					album: cleanAlbum(entry.Album || ''),
					trackNumber: Number(entry['Track Number'] || 0),
				};
			}
			break;
		}
	}
	return result;
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
			const playlistsArray = children[i + 1];
			const playlists = Array.from(playlistsArray.children).filter(el => el.tagName === 'dict');

			let targetPlaylist = null;
			for (const dict of playlists) {
				const kids = Array.from(dict.children);
				for (let j = 0; j < kids.length - 1; j++) {
					if (kids[j].tagName === 'key' &&
						kids[j].textContent === 'Name' &&
						(!playlistName || kids[j + 1].textContent === playlistName)) {
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

			const targetChildren = Array.from(targetPlaylist.children);
			for (let k = 0; k < targetChildren.length - 1; k++) {
				if (targetChildren[k].tagName === 'key' &&
					targetChildren[k].textContent === 'Playlist Items') {
						const itemsArray = targetChildren[k + 1];
						const items = Array.from(itemsArray.children).filter(el => el.tagName === 'dict');
						const ids = [];

						for (const itemDict of items) {
							const itemChildren = Array.from(itemDict.children);
							for (let m = 0; m < itemChildren.length - 1; m++) {
								if (itemChildren[m].tagName === 'key' &&
									itemChildren[m].textContent === 'Track ID' &&
									itemChildren[m + 1].tagName === 'integer') {
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