export function parseTracks(xmlDoc) {
	const result = {};

	// select top-level <dict> element under <plist>
	const rootDict = xmlDoc.querySelector('plist > dict');
	// convert to child nodes for easier iteration
	const children = Array.from(rootDict.children);

	/* cleaner functions */
	function cleanTrack(title) {
		title.replace(/\(.*?\)/g, ' '); // Remove anything in parentheses
		title.replace(/[’']/g, ' '); // Replace quotes with spaces
		title.replace(/[\/\-]/g, ' '); // Replace / and - with spaces
		title.trim(); // Trim leading/trailing spaces
		title.replace(/\s+/g, ' '); // Collapse multiple spaces into one
		return title;
	}

	function cleanAlbum(album) {
		album.replace(/\b(remastered|deluxe)\b/gi, '') // Drop these words
		album.replace(/\(.*?\)/g, ' ');
		album.replace(/[’']/g, ' ');
		album.replace(/[\/\-]/g, ' ');
		album.trim();
		album.replace(/\s+/g, ' ');
		return album;
	}

	function cleanArtist(name) {
    if (name === 'The The') return name; // Edge case
		name.replace(/^The\s+/i, ''); // Strip leading "The "
		name.replace(/&/g, 'and'); // Convert ampersand to "and"
		name.trim();
		return name;
	}

	// find the tracks
	for (let i = 0; i < children.length; i++) {
		const node = children[i];
		if (node.tagName === 'key' && node.textContext === 'Tracks') {
			const tracksDict = children[i+1];
			const pairs = Array.from(tracksDict.children);
			for (let j = 0; j < pairs.length; j += 2) {
				const id = Number(pairs[j].textContext);
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