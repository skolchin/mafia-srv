const express = require('express');
const logger = require('morgan');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const passport = require('passport');

const User = require('./routes/user');
const Game = require('./routes/game');

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.set('port', PORT);
app.set('env', NODE_ENV);

app.use(logger('tiny'));
app.use(express.json());
app.use(express.urlencoded());
app.use(cors());
app.use(session({
  genid: (req) => uuidv4(),
  store: new FileStore(),
  secret: '<secret>',
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(User.initStrategy());
passport.serializeUser(User.serializeUser);
passport.deserializeUser(User.deserializeUser);

app.post('/api/v1/auth/', User.postLoginUser);
app.post('/api/v1/psw/', User.postSetPassword);
app.post('/api/v1/user/', User.postUpdateUser);
app.post('/api/v1/name_check/', User.getCheckName);
app.get('/api/v1/a', User.getPhoto);
app.post('/api/v1/set_photo/', User.postUpdatePhoto);

app.get('/api/v1/game', Game.getGame);
app.get('/api/v1/games', Game.getListGames);
app.get('/api/v1/updates', Game.getUpdatedGames);
app.post('/api/v1/game/', Game.postUpdateGame);

app.use((req, res, next) => {
  const err = new Error(`${req.method} ${req.url} Not Found`);
  err.status = 404;
  next(err);
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500);
  res.json({
    error: {
      message: err.message,
    },
  });
});

app.listen(PORT, () => {
  console.log(`Mafia server started on ${app.get('port')} | Environment : ${app.get('env')}`);
});
