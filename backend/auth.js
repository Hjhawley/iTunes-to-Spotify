const express = require("express");
const request = require("request");
const cors = require("cors");
const querystring = require("querystring");
const cookieParser = require("cookie-parser");

const { generateRandomString } = require("./utils");

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const spotify_redirect = process.env.SPOTIFY_REDIRECT_URI;
const frontend_redirect = process.env.FRONTEND_REDIRECT_URI;

const stateKey = "spotify_auth_state";
const router = express.Router();

// check if the app is deployed
const isProd = process.env.NODE_ENV === "production";

// middleware setup
router.use(express.static(__dirname + "/public")).use(cookieParser());

// initiate Spotify OAuth login
router.get("/auth/login", function (req, res) {
  const state = generateRandomString(16);
  res.cookie(stateKey, state);
  const scope =
    "user-read-private user-read-email playlist-modify-public playlist-modify-private";
  // redirect user to Spotify authorization URL, force account selection
  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: client_id,
        scope: scope,
        redirect_uri: spotify_redirect,
        state: state,
        show_dialog: true, // force Spotify to show login dialog
      })
  );
});

// Spotify redirect callback - handles token exchange
router.get("/auth/callback", (req, res) => {
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

  // validate state to prevent CSRF
  if (!state || state !== storedState) {
    // state mismatch
    return res.redirect(
      "/#" + querystring.stringify({ error: "state_mismatch" })
    );
  }

  // state checks out, clear it
  res.clearCookie(stateKey);

  // token exchange request to Spotify
  const authOptions = {
    url: "https://accounts.spotify.com/api/token",
    form: {
      code: code,
      redirect_uri: spotify_redirect,
      grant_type: "authorization_code",
    },
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(client_id + ":" + client_secret).toString("base64"),
    },
    json: true,
  };

  request.post(authOptions, (err, response, tokenBody) => {
    if (err || response.statusCode !== 200) {
      return res.redirect(
        "/#" + querystring.stringify({ error: "invalid_token" })
      );
    }

    const access_token = tokenBody.access_token;
    const refresh_token = tokenBody.refresh_token;

    // fetch the user profile
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

      const redirectUrl = `${frontend_redirect}?token_set=true&access_token=${encodeURIComponent(
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

// handle /auth/session
router.post("/auth/session", express.json(), (req, res) => {
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

// refresh access token using refresh token
router.get("/auth/refresh_token", function (req, res) {
  const refresh_token = req.query.refresh_token;
  const authOptions = {
    url: "https://accounts.spotify.com/api/token",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        new Buffer.from(client_id + ":" + client_secret).toString("base64"),
    },
    form: {
      grant_type: "refresh_token",
      refresh_token: refresh_token,
    },
    json: true,
  };

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      const access_token = body.access_token,
        refresh_token = body.refresh_token;
      res.send({
        access_token: access_token,
        refresh_token: refresh_token,
      });
    }
  });
});

// return current user profile using stored token
router.get("/auth/whoami", function (req, res) {
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

// 'Logging out' by just unassigning client_id, state, etc...
router.get("/auth/logout", function (req, res) {
  res.client_id = null;
  res.client_secret = null;
  res.state = null;
  res.access_token = null;
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
