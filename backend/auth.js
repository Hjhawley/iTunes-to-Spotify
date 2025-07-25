const express = require("express");
const request = require("request");
const cors = require("cors");
const querystring = require("querystring");
const cookieParser = require("cookie-parser");
const { generateRandomString } = require("./utils");

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const spotify_redirect = process.env.SPOTIFY_REDIRECT_URI; // "itunestospotify://callback"
const frontend_redirect = process.env.FRONTEND_REDIRECT_URI; // "https://itunes-to-spotify.onrender.com"

const stateKey = "spotify_auth_state";
const router = express.Router();

// Determine if running in production mode
const isProd = process.env.NODE_ENV === "production";

// Middleware to serve static files (if needed) and parse cookies
router.use(express.static(__dirname + "/public"));
router.use(cookieParser());

// All routes below are relative to `/auth`

// Initiate Spotify OAuth login
router.get("/login", (req, res) => {
  const state = generateRandomString(16);
  res.cookie(stateKey, state);

  const scope =
    "user-read-private user-read-email playlist-modify-public playlist-modify-private";

  // Allow dynamic redirect_uri from query parameter (for mobile/web support)
  const redirectUri = req.query.redirect_uri || spotify_redirect;

  // Redirect to Spotify's login page
  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id,
        scope,
        redirect_uri: redirectUri,
        state,
        show_dialog: true, // Always show login screen
      })
  );
});

// Spotify redirect callback - handles token exchange
router.get("/callback", (req, res) => {
  // Handle Spotify login cancellation or error
  if (req.query.error) {
    // Redirect to frontend with error message
    return res.redirect(
      `${frontend_redirect}?` +
        querystring.stringify({ error: req.query.error })
    );
  }

  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies[stateKey] : null;

  if (!state || state !== storedState) {
    return res.redirect(
      "/#" + querystring.stringify({ error: "state_mismatch" })
    );
  }

  res.clearCookie(stateKey);

  const authOptions = {
    url: "https://accounts.spotify.com/api/token",
    form: {
      code,
      redirect_uri: spotify_redirect, // Use the original redirect_uri for token exchange
      grant_type: "authorization_code",
    },
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${client_id}:${client_secret}`).toString("base64"),
    },
    json: true,
  };

  request.post(authOptions, (err, response, tokenBody) => {
    if (err || response.statusCode !== 200) {
      return res.redirect(
        "/#" + querystring.stringify({ error: "invalid_token" })
      );
    }

    const { access_token, refresh_token } = tokenBody;

    // Fetch Spotify user profile
    const meOptions = {
      url: "https://api.spotify.com/v1/me",
      headers: { Authorization: `Bearer ${access_token}` },
      json: true,
    };

    request.get(meOptions, (err, response, meBody) => {
      if (err || response.statusCode !== 200) {
        return res.redirect(
          "/#" + querystring.stringify({ error: "profile_error" })
        );
      }

      const cookieOptions = {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "None" : "Lax",
        path: "/",
      };

      // Determine redirect URL based on the original request
      const redirectUri = req.query.redirect_uri || spotify_redirect;
      const redirectUrl = redirectUri.startsWith("itunestospotify")
        ? `${redirectUri}?access_token=${encodeURIComponent(
            access_token
          )}&refresh_token=${encodeURIComponent(
            refresh_token
          )}&spotify_id=${encodeURIComponent(meBody.id)}`
        : `${frontend_redirect}?token_set=true&access_token=${encodeURIComponent(
            access_token
          )}&refresh_token=${encodeURIComponent(
            refresh_token
          )}&spotify_id=${encodeURIComponent(meBody.id)}`;

      res
        .cookie("access_token", access_token, cookieOptions)
        .cookie("refresh_token", refresh_token, cookieOptions)
        .cookie("spotify_id", meBody.id, cookieOptions)
        .redirect(redirectUrl);
    });
  });
});

// Save credentials from frontend
router.post("/session", express.json(), (req, res) => {
  const { access_token, refresh_token, spotify_id } = req.body;

  if (!access_token || !refresh_token || !spotify_id) {
    return res.status(400).json({ error: "Missing credentials" });
  }

  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
    path: "/",
  };

  res
    .cookie("access_token", access_token, cookieOptions)
    .cookie("refresh_token", refresh_token, cookieOptions)
    .cookie("spotify_id", spotify_id, cookieOptions)
    .json({ success: true });
});

// Refresh access token
router.get("/refresh_token", (req, res) => {
  const refresh_token = req.query.refresh_token;

  const authOptions = {
    url: "https://accounts.spotify.com/api/token",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${client_id}:${client_secret}`).toString("base64"),
    },
    form: {
      grant_type: "refresh_token",
      refresh_token,
    },
    json: true,
  };

  request.post(authOptions, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      const { access_token, refresh_token } = body;
      res.send({ access_token, refresh_token });
    } else {
      res.status(500).json({ error: "Failed to refresh token" });
    }
  });
});

// Return Spotify profile for current user
router.get("/whoami", (req, res) => {
  const access_token = req.cookies.access_token;

  if (!access_token) {
    return res.status(401).json({ error: "Not logged in" });
  }

  const options = {
    url: "https://api.spotify.com/v1/me",
    headers: { Authorization: "Bearer " + access_token },
    json: true,
  };

  request.get(options, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      res.json(body);
    } else {
      res.status(401).json({ error: "Invalid token" });
    }
  });
});

// Log out: clear relevant cookies and redirect home
router.get("/logout", (req, res) => {
  res
    .clearCookie("access_token", {
      path: "/",
      sameSite: "None",
      secure: true,
    })
    .clearCookie("refresh_token", {
      path: "/",
      sameSite: "None",
      secure: true,
    })
    .clearCookie("spotify_id", {
      path: "/",
      sameSite: "None",
      secure: true,
    })
    .redirect(`${frontend_redirect}`);
});

module.exports = router;