require('dotenv').config();
import express from 'express';
import session from 'express-session';
import importRouter from './import.js';

const app = express();

app.use(
	session({
		secret: process.env.SESSION_SECRET,
		resave: false, // don’t force–save unchanged sessions
		saveUninitialized: false, // don’t save empty sessions
	})
);

/* TESTING */
// stub out req.user to test /import before auth is wired
app.use((req, res, next) => {
	req.user = {
		accessToken: 'FAKE_TOKEN',
		spotifyId: 'FAKE_USER_ID',
	};
	next();
});

app.use('/import', importRouter);

app.listen(4000, () => {
	console.log('Server running on http://localhost:4000');
});
