const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRouter = require("./auth");
const importRouter = require("./import");

const app = express();
const PORT = process.env.PORT || 8888;

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS setup
const allowedOrigins = [
  "http://localhost:5173", // for local dev
  "https://itunes-to-spotify.onrender.com", // Render deployment (same origin now)
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Routes
app.use("/auth", authRouter);
app.use("/import", importRouter);

// Serve built frontend
const distPath = path.resolve(__dirname, "../dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// Pulse check
app.get("/ping", (req, res) => res.send("pong"));

// Error handling
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Graceful shutdown & debug
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  console.log("Server will continue running...");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  console.log("Server will continue running...");
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("Received SIGINT. Exiting...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM. Exiting...");
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
