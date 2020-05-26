const express = require('express');
const logger = require('morgan');
const cors = require('cors');
const UserRoutes = require('./routes/user');
const GameRoutes = require('./routes/game');

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.set('port', PORT);
app.set('env', NODE_ENV);

app.use(logger('tiny'));
app.use(express.json());
app.use(express.urlencoded());
app.use(cors());

app.post('/api/v1/auth/', UserRoutes.postLoginUser);
app.post('/api/v1/psw/', UserRoutes.postSetPassword);
app.post('/api/v1/user/', UserRoutes.postUpdateUser);
app.post('/api/v1/name_check/', UserRoutes.getCheckName);
app.get('/api/v1/a', UserRoutes.getPhoto);
app.post('/api/v1/set_photo/', UserRoutes.postUpdatePhoto);

app.get('/api/v1/game', GameRoutes.getGame);
app.get('/api/v1/games', GameRoutes.getListGames);
app.get('/api/v1/updates', GameRoutes.getUpdatedGames);
app.post('/api/v1/game/', GameRoutes.postUpdateGame);

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
