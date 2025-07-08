require('dotenv').config(); // Load .env variables
const express = require('express');
const session = require('express-session'); // optional if you want session handling
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRouter = require('./auth');
const importRouter = require('./import');

const app = express();
const PORT = process.env.PORT || 8888;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount routers
app.use('/', authRouter);
app.use('/', importRouter);

// Health check (optional)
app.get('/ping', (req, res) => res.send('pong'));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
