const express = require("express");
const session = require("express-session");
const authRoutes = require("./auth");
const generateRandomString = require("./utils");

require("dotenv").config();

const port = process.env.port || 8888;

var app = express();

app.use(
  session({
    secret: generateRandomString(24),
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

app.use("/auth", authRoutes);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
