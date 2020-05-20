const express = require('express');
const logger = require('morgan');
const cors = require('cors');
const { routeLoginUser, routeSetPassword } = require('./routes/user');
const { routeListGames, routeNewGame } = require('./routes/game');

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.set('port', PORT);
app.set('env', NODE_ENV);

app.use(logger('tiny'));
app.use(express.json());
app.use(express.urlencoded());
//app.options('*', cors());
//app.use(cors({origin: 'http://localhost:3000'}));
app.use(cors());

app.post('/api/v1/auth/', routeLoginUser);
app.post('/api/v1/psw/', routeSetPassword);
app.post('/api/v1/new_game/', routeNewGame);

app.get('/api/v1/games', routeListGames);


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
