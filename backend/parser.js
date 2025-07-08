export function parsePlaylistName(xmlDoc) {
	// select top-level <dict> element under <plist>
	const rootDict = xmlDoc.querySelector('plist > dict');
	// convert to child nodes for easier iteration
	const rootElements = Array.from(rootDict.children);

	const index = rootElements.findIndex(node => node.tagName === 'key' && node.textContent === 'Playlists');
	if (index === -1) return null;

	const playlistsArray = rootElements[index+1];
	const firstPlaylist = Array.from(playlistsArray.children).find(el => el.tagName === 'dict');
	if (!firstPlaylist) return null;

	const elements = Array.from(firstPlaylist.children);
	const nameIndex = elements.findIndex(node => node.tagName === 'key' && node.textContent === 'Name');
	if (nameIndex === -1) return null;

	return elements[nameIndex+1].textContent;
}

export function parseTracks(xmlDoc) {
	const result = {};
	const rootDict = xmlDoc.querySelector('plist > dict');
	const rootElements = Array.from(rootDict.children);

	/* cleaner functions */
	function cleanTrack(title) {
		title = title.replace(/\(.*?\)/g, ' '); // Remove anything in parentheses
		title = title.replace(/[’']/g, ' '); // Replace quotes with spaces
		title = title.replace(/[\/\-]/g, ' '); // Replace / and - with spaces
		title = title.trim(); // Trim leading/trailing spaces
		title = title.replace(/\s+/g, ' '); // Collapse multiple spaces into one
		return title;
	}

	function cleanAlbum(album) {
		album = album.replace(/\b(remastered|deluxe)\b/gi, ''); // Drop these words
		album = album.replace(/\(.*?\)/g, ' ');
		album = album.replace(/[’']/g, ' ');
		album = album.replace(/[\/\-]/g, ' ');
		album = album.trim();
		album = album.replace(/\s+/g, ' ');
		return album;
	}

	function cleanArtist(name) {
    if (name === 'The The') return name; // Edge case
		name = name.replace(/^The\s+/i, ''); // Strip leading "The "
		name = name.replace(/&/g, 'and'); // Convert ampersand to "and"
		name = name.trim();
		return name;
	}

	// find the 'tracks' section
	for (let i = 0; i < rootElements.length; i++) {
		const node = rootElements[i];
		if (node.tagName === 'key' && node.textContent === 'Tracks') {
			const tracksDict = rootElements[i+1];
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

export function parsePlaylistOrder(xmlDoc, playlistName = null) {
	const rootDict = xmlDoc.querySelector('plist > dict');
	const rootElements = Array.from(rootDict.children);

	// find the 'playlists' section
	for (let i = 0; i < rootElements.length; i++) {
		const node = rootElements[i];
		if (node.tagName === 'key' && node.textContent === 'Playlists') {
			const playlistsArray = rootElements[i+1];
			const playlists = Array.from(playlistsArray.children).filter(element => element.tagName === 'dict');

			// find the target playlist by name, or default to the first one
			let targetPlaylist = null;
			for (const dict of playlists) {
				const playlistElements = Array.from(dict.children);
				for (let j = 0; j < playlistElements.length - 1; j++) {
					if (playlistElements[j].tagName === 'key' &&
						playlistElements[j].textContent === 'Name' &&
						(!playlistName || playlistElements[j + 1].textContent === playlistName)) {
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
			for (let k = 0; k < playlistChildren.length-1; k++) {
				const child = playlistChildren[k];
				if (child.tagName === 'key' && child.textContent === 'Playlist Items') {
					// next sibling is an array of item dicts
					const itemsArray = playlistChildren[k+1];
					const items = Array.from(itemsArray.children).filter(el => el.tagName === 'dict');
					const ids = [];

					// Each item dict holds a Track ID entry
					for (const itemDict of items) {
						const itemChildren = Array.from(itemDict.children);
						for (let m = 0; m < itemChildren.length-1; m++) {
							if (
								itemChildren[m].tagName === 'key' &&
								itemChildren[m].textContent === 'Track ID' &&
								itemChildren[m + 1].tagName === 'integer'
							) {
								ids.push(Number(itemChildren[m+1].textContent));
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
