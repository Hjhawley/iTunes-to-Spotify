// /auth/login, /auth/callback, /auth/whoami
const fetch = require("node-fetch");
const express = require("express");
const querystring = require("querystring");
const { appendFile } = require("fs");

var router = express.Router();

var spotify_client_id = process.env.SPOTIFY_CLIENT_ID;
var spotify_client_secret = process.env.SPOTIFY_CLIENT_SECRET;
var redirect_uri = "http://127.0.0.1:4000/auth/callback";

var generateRandomString = function (length) {
  var text = "";
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

router.get("/auth/login", function (req, res) {
  var state = generateRandomString(16);
  var scope = `user-read-private user-read-email`;

  var auth_query_parameters = new URLSearchParams({
    response_type: "code",
    client_id: spotify_client_id,
    scope: scope,
    redirect_uri: "http://127.0.0.1:4000/auth/callback",
    state: state,
  });

  res.redirect(
    "https://accounts.spotify.com/authorize?" + auth_query_parameters.toString()
  );
});

router.get("/auth/callback", async function (req, res) {
  const code = req.query.code;
  const state = req.query.state || null;

  var authOptions = {
    url: "https://accounts.spotify.com/api/token",
    form: {
      code: code,
      redirect_uri: "http://127.0.0.1:4000/auth/callback",
      grant_type: "authorization_code",
    },
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(spotify_client_id + ":" + spotify_client_secret).toString(
          "base64"
        ),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    json: true,
  };
  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.redirect("/");
    }
  });
});

router.get("/auth/token", (req, res) => {
  res.json({
    access_token: access_token,
  });
});

router.get("/auth/whoami", function (req, res) {
  res.json(req.session ? req.session.spotifyAuth || {} : {});
});

module.exports = router;
