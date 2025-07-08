import 'dotenv/config';
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

/* // DEV stub so req.user.exists
app.use((req, _res, next) => {
	req.user = { accessToken: 'FAKE_TOKEN', spotifyId: 'FAKE_USER_ID' };
	next();
}); */

// since import.js has: router.post('/import', …)
app.use(importRouter);

app.listen(8888, () => console.log('Server running on http://localhost:8888'));
