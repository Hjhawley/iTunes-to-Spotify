const express = require("express");
const dotenv = require("dotenv");
const session = require("express-session");
const authRoutes = require("./auth");

dotenv.config();
const port = 4000;

var spotify_client_id = process.env.SPOTIFY_CLIENT_ID;
var spotify_client_secret = process.env.SPOTIFY_CLIENT_SECRET;

var app = express();
app.use(
  session({
    secret: generateRandomString(24),
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

// Helper function to generate a random integer between min (inclusive) and max (exclusive)
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

// Helper function to generate a random string of given length
function generateRandomString(length) {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    text += possible.charAt(getRandomInt(0, possible.length));
  }
  return text;
}

app.use("/auth", authRoutes);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
