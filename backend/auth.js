const express = require("express");
const request = require("request");
const cors = require("cors");
const querystring = require("querystring");
const cookieParser = require("cookie-parser");

var generateRandomString = require('./utils');
const express = require("express");
const request = require("request");
const crypto = require("crypto");
const cors = require("cors");
const querystring = require("querystring");
const cookieParser = require("cookie-parser");
const { generateRandomString } = require('./utils');

var client_id = process.env.SPOTIFY_CLIENT_ID;
var client_secret = process.env.SPOTIFY_CLIENT_SECRET;
var redirect_uri = process.env.SPOTIFY_REDIRECT_URI;
const client_id = `d2b73b9ffc8b40c79aef4890db82237a`;
const client_secret = `818c0389ed9648f289235ef7e0fcc946`;
const redirect_uri = `http://localhost:8080/auth/callback`;

const generateRandomString = (length) => {
  return crypto.randomBytes(60).toString("hex").slice(0, length);
};

const stateKey = "spotify_auth_state";
const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = process.env.SPOTIFY_REDIRECT_URI;

const stateKey = "spotify_auth_state";

const router = express.Router();
const router = express.Router();

router
  .use(express.static(__dirname + "/public"))
  .use(cookieParser());

router.get("/login", function (req, res) {
  var state = generateRandomString(16);
router.get("/auth/login", function (req, res) {
  const state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  const scope = 
    "user-read-private user-read-email playlist-modify-public playlist-modify-private";
  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: client_id,
        scope: scope,
        redirect_uri: redirect_uri,
        state: state,
      })
  );
});

router.get("/auth/callback", (req, res) => {
  const code = req.query.code  || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies[stateKey] : null;

  if (!state || state !== storedState) {
    // State mismatch
    return res.redirect(
      "/#" + querystring.stringify({ error: "state_mismatch" })
  if (!state || state !== storedState) {
    // State mismatch
    return res.redirect(
      "/#" + querystring.stringify({ error: "state_mismatch" })
    );
  }

  // State checks out, clear it
  res.clearCookie(stateKey);

  // Exchange code for tokens
  const authOptions = {
    url: "https://accounts.spotify.com/api/token",
    form: {
      code:         code,
      redirect_uri: redirect_uri,
      grant_type:   "authorization_code"
    },
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(client_id + ":" + client_secret).toString("base64")
    },
    json: true
  };

  request.post(authOptions, (err, response, tokenBody) => {
    if (err || response.statusCode !== 200) {
      return res.redirect(
        "/#" + querystring.stringify({ error: "invalid_token" })
      );
    }

    const access_token  = tokenBody.access_token;
    const refresh_token = tokenBody.refresh_token;

    // fetch the user profile
    const meOptions = {
      url:    "https://api.spotify.com/v1/me",
      headers:{ Authorization: `Bearer ${access_token}` },
      json:   true
    };

    request.get(meOptions, (err, response, meBody) => {
      if (err || response.statusCode !== 200) {
        return res.redirect(
          "/#" + querystring.stringify({ error: "profile_error" })
        );
      }

      // set all three cookies on path "/"
      res
        .cookie("access_token", access_token, { httpOnly: true, sameSite: "lax", path: "/" })
        .cookie("refresh_token", refresh_token, { httpOnly: true, sameSite: "lax", path: "/" })
        .cookie("spotify_id", meBody.id, { httpOnly: true, sameSite: "lax", path: "/" })
        .redirect("http://localhost:5173/");
    });
  });
});

router.get("/refresh_token", function (req, res) {
  var refresh_token = req.query.refresh_token;
  var authOptions = {
router.get("/auth/refresh_token", function (req, res) {
  const refresh_token = req.query.refresh_token;
  const authOptions = {
    url: "https://accounts.spotify.com/api/token",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(client_id + ":" + client_secret).toString("base64"),
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
      const access_token = body.access_token,
        refresh_token = body.refresh_token;
      res.send({
        access_token: access_token,
        refresh_token: refresh_token,
      });
    }
  });
});

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

module.exports = router;
