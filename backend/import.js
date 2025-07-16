const express = require("express");
const multer = require("multer");
const { JSDOM } = require("jsdom");
const cookieParser = require("cookie-parser");

// extract track metadata
const { parseTracks, parsePlaylistName } = require("./parser");
// Spotify API wrappers
const { createPlaylist, getTrackById, findBestTrack, addTracks } = require("./spotify");

const router = express.Router();
router.use(cookieParser());

// for file upload handling
const upload = multer({ storage: multer.memoryStorage() });

// middleware: load user info from cookies and attach to req.user
function loadUserFromCookies(req, res, next) {
  const access_token = req.cookies.access_token;
  const spotify_id = req.cookies.spotify_id;
  if (!access_token || !spotify_id) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  req.user = {
    accessToken: access_token,
    spotifyId: spotify_id,
  };
  next();
}

/* POST /songs
   Receives an iTunes playlist in XML format
   Parses the file and extracts track data
   Matches each track to a Spotify URI
    Returns the import page */
router.post(
  "/songs",
  upload.single("file"),
  loadUserFromCookies,
  async (req, res) => {
    const logs = [];
    try {
      const token = req.user.accessToken;
      if (!token) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      logs.push({ text: `Received file: ${req.file.originalname}` });

      // parse XML buffer into a DOM
      logs.push({ text: "Parsing iTunes playlist..." });
      const raw = req.file.buffer.toString("utf-8");
      const dom = new JSDOM(raw, { contentType: "text/xml" });
      const xmlDoc = dom.window.document;

      // extract tracks
      const trackMap = parseTracks(xmlDoc);
      const tracks = Object.values(trackMap);
      logs.push({ text: `Parsed ${tracks.length} tracks` });

      // match each track to a Spotify URI
      const uris = [];
      for (const { artist, name, album, trackNumber } of tracks) {
        const { uri, score } = await findBestTrack(token, {
          artist,
          name,
          album,
          trackNumber,
        });
        if (uri) {
          uris.push(uri.slice(14)); // remove "spotify:track:"
        } else {
          logs.push({ text: `No match for ${artist} - ${name}` });
        }
      }
      if (uris.length > 0) {
        const results = await fetch(
          `https://api.spotify.com/v1/tracks?ids=${uris.join(",")}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const body = await results.json();
        res.send(
          body.tracks.map((track) => ({
            name: track.name,
            artists: track.artists.map((artist) => artist.name).join(", "),
            pic: track.album.images[0].url,
            duration: `${Math.floor(track.duration_ms / 60000)}:${String(
              Math.floor((track.duration_ms / 1000) % 60)
            ).padStart(2, "0")}`,
          }))
        );
      } else {
        res.send([]);
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/* POST /import
    Receives an iTunes playlist in XML format
    Parses the file and extracts track data
    Creates a Spotify playlist, matches each track, adds them
    Returns log messages */
router.post(
  "/import",
  upload.single("file"),
  loadUserFromCookies,
  async (req, res) => {
    const logs = [];
    try {
      const token = req.user.accessToken;
      if (!token) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      logs.push({ text: `Received file: ${req.file.originalname}` });

      // parse XML buffer into a DOM
      logs.push({ text: "Parsing iTunes playlist..." });
      const raw = req.file.buffer.toString("utf-8");
      const dom = new JSDOM(raw, { contentType: "text/xml" });
      const xmlDoc = dom.window.document;

      // extract tracks
      const trackMap = parseTracks(xmlDoc);
      const tracks = Object.values(trackMap);
      logs.push({ text: `Parsed ${tracks.length} tracks` });

      // create a new Spotify playlist
      const playlistName = parsePlaylistName(xmlDoc) || "iTunes Playlist";
      logs.push({ text: `Migrating Spotify playlist: "${playlistName}"` });
      const playlistId = await createPlaylist(token, playlistName);
      logs.push({ text: `Playlist created (ID: ${playlistId})` });

      // match each track to a Spotify URI
      const uris = [];
      for (const { artist, name, album, trackNumber } of tracks) {
        logs.push({ text: `Searching Spotify for "${artist} - ${name}"` });
        const { uri, score } = await findBestTrack(token, { artist, name, album, trackNumber });

        // normalize score to percentage
        const confidence = (typeof score === 'number' && score <= 1) 
          ? Math.round(score * 100) 
          : score;

        // apply 50% confidence cutoff
        if (uri && confidence >= 50) {
          const trackId = uri.split(":").pop();
          const trackInfo = await getTrackById(token, trackId);
          const pic = trackInfo.album.images[0]?.url;

          uris.push(uri);
          logs.push({ 
            text: `Matched!`, 
            pic, 
            score: confidence,
          });
        } else {
          logs.push({ 
            text: `No match found.`, 
            score: null, 
          });
        }
      }

      // add matched URIs to the playlist
      if (uris.length) {
        logs.push({ text: `Adding ${uris.length} tracks to playlist` });
        await addTracks(token, playlistId, uris);
        logs.push({ text: "Tracks successfully added!" });
      } else {
        logs.push({ text: "No tracks to add" });
      }

      res.json(logs);
    } catch (err) {
      console.error(err);
      logs.push({ text: `Error: ${err.message}` });
      logs.push({ text: "Failed to migrate playlist." });
      res.status(500).json(logs);
    }
  }
);

module.exports = router;
