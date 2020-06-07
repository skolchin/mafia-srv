const express = require('express');
const logger = require('morgan');
const cors = require('cors');
const passport = require('passport');

const User = require('./routes/user');
const Game = require('./routes/game');

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.set('port', PORT);
app.set('env', NODE_ENV);
app.use(cors({
  credentials: true
}));

passport.use(User.authStrategy());
app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());
app.use(express.urlencoded());
app.use(logger('tiny'));

app.post('/api/v1/auth/', User.postLoginUser);
app.post('/api/v1/add_user/', User.postAddUser);
app.post('/api/v1/psw/', passport.authenticate('jwt', {session:false}), User.postSetPassword);
app.post('/api/v1/user/', passport.authenticate('jwt', {session:false}), User.postUpdateUser);
app.get('/api/v1/photo', User.getPhoto);
app.post('/api/v1/set_photo/', passport.authenticate('jwt', {session:false}), User.postUpdatePhoto);

app.get('/api/v1/game', passport.authenticate('jwt', {session:false}), Game.getGame);
app.get('/api/v1/games', passport.authenticate('jwt', {session:false}), Game.getListGames);
app.get('/api/v1/updates', passport.authenticate('jwt', {session:false}), Game.getUpdatedGames);
app.post('/api/v1/game/', passport.authenticate('jwt', {session:false}), Game.postUpdateGame);

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
