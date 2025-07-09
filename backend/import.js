const express = require("express");
const multer = require("multer");
const { JSDOM } = require("jsdom");
const cookieParser = require("cookie-parser");

// extract track metadata
const { parseTracks, parsePlaylistName } = require("./parser");
// Spotify API wrappers
const { createPlaylist, findBestTrack, addTracks } = require("./spotify");

const router = express.Router();
router.use(cookieParser());
const upload = multer({ storage: multer.memoryStorage() });

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

/**
POST /import
    Receives an iTunes XML/JSON file
    Parses it with parseTracks
    Creates a Spotify playlist, matches each track, adds them
    Returns log messages
 */
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
      logs.push(`Received file: ${req.file.originalname}`);

      // parse XML buffer into a DOM
      logs.push("Parsing iTunes playlist...");
      const raw = req.file.buffer.toString("utf-8");
      const dom = new JSDOM(raw, { contentType: "text/xml" });
      const xmlDoc = dom.window.document;
      const trackMap = parseTracks(xmlDoc);
      const tracks = Object.values(trackMap);
      logs.push(`Parsed ${tracks.length} tracks`);

      // create Spotify playlist
      const playlistName = parsePlaylistName(xmlDoc) || "iTunes Playlist";
      logs.push(`Migrating Spotify playlist: "${playlistName}"`);
      const playlistId = await createPlaylist(
        token,
        req.user.spotifyId,
        playlistName
      );
      logs.push(`Playlist created (ID: ${playlistId})`);

      // find best matching track URIs
      const uris = [];
      for (const { artist, name, album, trackNumber } of tracks) {
        logs.push(`Searching Spotify for "${artist} - ${name}"`);
        const uri = await findBestTrack(token, {
          artist,
          name,
          album,
          trackNumber,
        });
        if (uri) {
          uris.push(uri);
          logs.push(`Matched ${artist} - ${name}`);
        } else {
          logs.push(`No match for ${artist} - ${name}`);
        }
      }

      // add matched URIs to playlist
      if (uris.length) {
        logs.push(`Adding ${uris.length} tracks to playlist`);
        await addTracks(token, playlistId, uris);
        logs.push("Tracks successfully added");
      } else {
        logs.push("No tracks to add");
      }

      res.json(logs);
    } catch (err) {
      console.error(err);
      logs.push(`Error: ${err.message}`);
      res.status(500).json(logs);
    }
  }
);

module.exports = router;
