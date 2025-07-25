const express = require("express");
const multer = require("multer");
const { JSDOM } = require("jsdom");
const cookieParser = require("cookie-parser");
const { Readable } = require("stream");
const { parseTracks, parsePlaylistName } = require("./parser");
const {
  findBestTrack,
  getTrackById,
  createPlaylist,
  addTracks,
} = require("./spotify");

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
  req.user = { accessToken: access_token, spotifyId: spotify_id };
  next();
}

router.post(
  "/import",
  upload.single("file"),
  loadUserFromCookies,
  async (req, res) => {
    console.log("Cookies received:", req.cookies);
    console.log("User extracted:", req.user);
    try {
      const token = req.user.accessToken;
      if (!token) throw new Error("Not authenticated");
      if (!req.file) throw new Error("No file uploaded");

      // Parse entire XML
      const raw = req.file.buffer.toString("utf-8");
      const dom = new JSDOM(raw, { contentType: "text/xml" });
      const tracks = Object.values(parseTracks(dom.window.document));

      // Get playlist name
      const playlistName =
        parsePlaylistName(dom.window.document) || "iTunes Playlist";

      const foundTracks = [];

      for (let i = 0; i < tracks.length; i++) {
        const { artist, name, album, trackNumber } = tracks[i];

        const { uri, score } = await findBestTrack(token, {
          artist,
          name,
          album,
          trackNumber,
        });

        // Only add tracks that were found and have a reasonable confidence score
        if (uri && score >= 0.5) {
          trackFound = await fetch(
            `https://api.spotify.com/v1/tracks/${uri.split("ck:").pop()}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          if (!trackFound.ok) {
            console.error(
              `Failed to fetch track info for ${uri}: ${trackFound.statusText}`
            );
            continue;
          }
          const trackInfo = await trackFound.json();
          const pic = trackInfo.album.images[0]?.url;

          // Log the found track URI and album art

          // Add to the list of found tracks
          foundTracks.push({
            uri,
            albumUrl: trackInfo.external_urls.spotify,
            name: trackInfo.name,
            artist: trackInfo.artists[0]?.name,
            album: trackInfo.album.name,
            pic,
          });
        }
      }
      res.json({
        tracks: foundTracks,
        name: playlistName,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

router.post(
  "/import-stream",
  upload.single("file"),
  loadUserFromCookies,
  async (req, res) => {
    console.log("Cookies received:", req.cookies);
    console.log("User extracted:", req.user);
    // Switch to SSE
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const send = (obj) => {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    };

    try {
      const token = req.user.accessToken;
      if (!token) throw new Error("Not authenticated");
      if (!req.file) throw new Error("No file uploaded");

      send({ text: `Received file: ${req.file.originalname}` });
      send({ text: "Parsing iTunes playlist..." });

      // Parse entire XML
      const raw = req.file.buffer.toString("utf-8");
      const dom = new JSDOM(raw, { contentType: "text/xml" });
      const tracks = Object.values(parseTracks(dom.window.document));
      send({ text: `Parsed ${tracks.length} tracks` });

      // Create Spotify playlist immediately
      const playlistName =
        parsePlaylistName(dom.window.document) || "iTunes Playlist";
      send({ text: `Creating Spotify playlist “${playlistName}”...` });
      const playlistId = await createPlaylist(token, playlistName);
      send({ text: `Playlist created (ID: ${playlistId})` });

      // Loop: match → buffer → add in batches
      const BATCH_SIZE = 50;
      let buffer = [];

      for (let i = 0; i < tracks.length; i++) {
        const { artist, name, album, trackNumber } = tracks[i];
        send({
          text: `(${i + 1}/${
            tracks.length
          }) Searching: ${artist} - ${name} - ${album}`,
        });

        const { uri, score } = await findBestTrack(token, {
          artist,
          name,
          album,
          trackNumber,
        });

        // normalize to [0..100]
        const confidence =
          typeof score === "number" && score <= 1
            ? Math.round(score * 100)
            : score || 0;

        if (uri && confidence >= 50) {
          // look up the album art
          const trackId = uri.split(":").pop();
          const trackInfo = await getTrackById(token, trackId);
          const pic = trackInfo.album.images[0]?.url;

          buffer.push(uri);
          send({
            text: `Matched!`,
            pic,
            score: confidence,
          });
        } else {
          send({
            text: `No match found.`,
            score: null,
          });
        }

        // flush when we hit batch size
        if (buffer.length >= BATCH_SIZE) {
          send({ text: `Adding ${buffer.length} tracks...` });
          await addTracks(token, playlistId, buffer);
          send({ text: `Continuing...` });
          buffer = [];
        }
      }

      // flush any leftovers
      if (buffer.length) {
        send({ text: `Adding ${buffer.length} tracks...` });
        await addTracks(token, playlistId, buffer);
      }

      send({ text: "Playlist successfully migrated!" });
      res.end();
    } catch (err) {
      console.error(err);
      send({ text: `Error: ${err.message}` });
      send({ text: "Failed to migrate playlist." });
      res.end();
    }
  }
);

module.exports = router;
