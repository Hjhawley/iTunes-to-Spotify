export function cleanTrack(title) {
  // remove anything in (), any ’ or ' , and any / or - then collapse whitespace
  return title
    .replace(/\(.*?\)/g, ' ')
    .replace(/['’]/g, ' ')
    .replace(/[\/\-]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function cleanAlbum(album) {
  return album
    .replace(/\b(remastered|deluxe)\b/gi, '') // drop those words
    .replace(/\(.*?\)/g, ' ')
    .replace(/['’]/g, ' ')
    .replace(/[\/\-]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function cleanArtist(name) {
  if (name === 'The The') return name // annoying edge case
  return name
    .replace(/^The\s+/i, '')
    .replace(/&/g, 'and')
    .trim()
}
