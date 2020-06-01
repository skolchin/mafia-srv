const express = require('express');
const assert = require('assert');
const { MongoClient, ObjectId} = require('mongodb');

const { ERRORS, handleErrors } = require('./errors');
const { dbUrl, dbName } = require('./config');

class Game {

  // Fill calculated fields of game structure
  static populateFields = (game) => {
    const total = game.members.map(m => m.role !== 'leader' ? 1 : 0);
    const alive = game.members.map(m => m.role !== 'leader' && m.alive ? 1 : 0);
    const mafia = game.members.map(m => m.role === 'mafia' ? 1 : 0);
    const mafia_alive = game.members.map(m => m.role === 'mafia' && m.alive ? 1 : 0);
    const citizens = game.members.map(m => m.role === 'citizen' ? 1 : 0);
    const citizens_alive = game.members.map(m => m.role === 'citizen' && m.alive ? 1 : 0);
    const reduce_fn = (a, b) => a + b;
    return {
      ...game,
      stats: {
        total: [alive.reduce(reduce_fn), total.reduce(reduce_fn)],
        mafia: [mafia_alive.reduce(reduce_fn), mafia.reduce(reduce_fn)],
        citizens: [citizens_alive.reduce(reduce_fn), citizens.reduce(reduce_fn)],
      },
    }
  }

  // Fill calculated fields of game collection
  static populateFieldsMany = (games) => {
    return games.map(g => Game.populateFields(g));
  }

  // Get a game
  static findGame = function(db, params, callback) {
    db.collection('games').find({ '_id': ObjectId(params._id)}).toArray(function(db_err, docs) {
      if (db_err)
        callback(null, ERRORS.DB_ERROR, db_err);
      else
        callback(docs.length ? Game.populateFields(docs[0]) : null, docs.length ? 0 : ERRORS.GAME_NOT_FOUND);
    });
  }

  // Find games of given user
  static findUserGames = function(db, params, callback) {
    db.collection('games').find(
      {
        $or: [
          { 'leader._id': ObjectId(params.user_id) },
          { 'members._id': ObjectId(params.user_id) },
          { status : 'start' }
        ]
      })
    .toArray(function(err, docs) {
      if (err)
        callback(null, ERRORS.DB_ERROR, err);
      else {
        callback(Game.populateFieldsMany(docs), 0);
      }
    });
  }

  // Find games updated in period since
  static findUpdates = function(db, params, callback) {
    db.collection('games').find(
      {
        $or: [
          { 'leader._id': ObjectId(params.user_id) },
          { 'members._id': ObjectId(params.user_id) },
        ],
        modified: {$gte: params.since},
      })
    .toArray(function(err, docs) {
      if (err)
        callback(null, ERRORS.DB_ERROR, err);
      else {
        const changes = !docs.length ? null : docs.map(doc => {
          const hist = doc.history && doc.history.length ? doc.history[doc.history.length-1] : {type: 'none', };
          return {
            event: 'msg_game_update',
            ts: hist.ts,
            data: {
              game: Game.populateFields(doc),
              change: hist
            }
          }
        });
        callback(changes, 0);
      }
    });
  }

  // Actions of updateGame: new game
  static updMakeNewGame = function (db, params, callback) {
    const user = {
      _id: ObjectId(params.game.leader._id),
      name: params.game.leader.name,
      displayName: params.game.leader.displayName,
    }
    const game = {
      name: params.game.name || '<New game>',
      started: Date.now(),
      round: null,
      status: 'new',
      period: null,
      voting: null,
      leader: user,
      members: [{
        ...user,
        role: 'leader',
        alive: true,
      }],
      created: Date.now(),
      modified: Date.now(),
      history: [{
        type: 'new',
        user_id: user._id,
        ts: Date.now(),
      }]
    }
    db.collection('games').insertOne(
      game,
      {w:1}, 
      function(db_err) { 
        callback(game, db_err ? ERRORS.DB_ERROR : 0, db_err);
      }
    )
  }

  // Actions of updateGame: update name
  static updChangeGameName = function (db, params, callback) {
    if (!params.game._id)
      callback(null, ERRORS.GAME_NOT_FOUND)
    else if (!params.game.name || !params.game.name.trim())
      callback(params.game, ERRORS.EMPTY_GAME_NAME)
    else
      db.collection('games').updateOne(
        {_id: new ObjectId(params.game._id)},
        {
          $set: {name: params.game.name, modified: Date.now()},
          $push: {history: {type: 'name', user_id: ObjectId(params.user._id), ts: Date.now()}}
        },
        {w:1}, 
        function(db_err) { 
          if (db_err)
            callback(null, ERRORS.DB_ERROR, db_err)
          else
            Game.findGame(db, params.game, callback) 
        }
    )
  }

  // Actions of updateGame: next state
  static updNextGameState = function (db, params, callback) {
    if (!params.game._id)
      callback(null, ERRORS.GAME_NOT_FOUND)
    else if (!params.game.status)
      callback(null, ERRORS.INVALID_GAME_STATUS)
    else {
      const upd_callback = (db_err) => { 
        if (db_err)
          callback(null, ERRORS.DB_ERROR, db_err)
        else 
          Game.findGame(db, params.game, callback)
      };

      switch (params.game.status) {
        case 'new':
          db.collection('games').updateOne(
            {_id: ObjectId(params.game._id)},
            {
              $set: {status: 'start', modified: Date.now()},
              $push: {
                history: {
                  type: 'status', user_id: ObjectId(params.user._id), status: 'start', ts: Date.now()
                }
              }
            },
            {w:1}, 
            upd_callback
          );
          break;
  
        case 'start':
          Game.findGame(db, params.game, function(game, err, db_err) {
            if (err)
              return callback(null, err, db_err)
            if (game.members.length < 4)
              return callback(null, ERRORS.NOT_ENOUGHT_MEMBERS)

            const mafiaTotal = ((game.members.length - 1) / 3) >> 0;
            var mafiaCount = 0;
            const new_members = game.members.map((m, n) => {
              if (m.role === 'leader') 
                return m
              else {
                const isMafia = Math.random() < 0.5;
                const notEnoughtMafia = (n > game.members.length - mafiaTotal + mafiaCount - 1);
                const _role = (notEnoughtMafia || (isMafia && mafiaCount < mafiaTotal) ? 'mafia' : 'citizen');
                if (_role === 'mafia')
                  mafiaCount = mafiaCount + 1;
                return {...m, role: _role, alive: true }
              }
            })

            db.collection('games').updateOne(
              {_id: ObjectId(params.game._id)},
              {
                $set: {
                  status: 'active', 
                  round: 1, 
                  period: 'day', 
                  members: new_members, 
                  modified: Date.now()
                },
                $push: {
                  history: {
                    type: 'status', user_id: ObjectId(params.user._id), status: 'active', ts: Date.now()
                  }
                }
              },
              {w:1}, 
              upd_callback
            );
          });
          break;

        case 'active':
          if (params.game.period === 'day')
            db.collection('games').updateOne(
              {_id: ObjectId(params.game._id)},
              {
                $set: {
                  period: 'night', modified: Date.now()
                },
                $push: {
                  history: {
                    type: 'period', user_id: ObjectId(params.user._id), period: 'night', ts: Date.now()
                  }
                }
              },
              {w:1}, 
              upd_callback
            )
          else 
            db.collection('games').updateOne(
              {_id: ObjectId(params.game._id)},
              {
                $set: {
                  period: 'day', modified: Date.now(), 
                },
                $inc: {round: 1},
                $push: {
                  history: {
                    type: 'period', user_id: ObjectId(params.user._id), period: 'day', ts: Date.now()
                  }
                }
              },
              {w:1}, 
              upd_callback
            )
          break;
  
        default:
          console.log('Unknown game state ' + params.game._id)
      }
    }
  }

  // Actions of updateGame: join game
  static updJoinGame = function (db, params, callback) {
    if (!params.game._id)
      callback(null, ERRORS.GAME_NOT_FOUND)
    else if (!params.game.status)
      callback(null, ERRORS.INVALID_GAME_STATUS)
    else if (!params.user || !params.user._id)
      callback(null, ERRORS.USER_NOT_FOUND)
    else {
        db.collection('games').updateOne(
          {_id: ObjectId(params.game._id)},
          {
            $set: {
              modified: Date.now()
            },
            $push: {
              members: {
                _id: ObjectId(params.user._id),
                name: params.user.name,
                displayName: params.user.displayName,
              },
              history: {
                type: 'join', user_id: ObjectId(params.user._id), ts: Date.now()
              }
            }
          },
          {w:1}, 
          function(db_err) { 
            if (db_err)
              callback(null, ERRORS.DB_ERROR, db_err)
            else 
              Game.findGame(db, params.game, callback)
          }
        )
      }
  }

  // Actions of updateGame: cancel game
  static updCancelGame = function (db, params, callback) {
    if (!params.game._id)
      callback(null, ERRORS.GAME_NOT_FOUND)
    else if (!params.game.status)
      callback(null, ERRORS.INVALID_GAME_STATUS)
    else {
        db.collection('games').updateOne(
          {_id: ObjectId(params.game._id)},
          {
            $set: {
              status: 'cancel', 
              modified: Date.now()
            },
            $push: {
              history: {
                type: 'cancel', user_id: ObjectId(params.user._id), status: 'cancel', ts: Date.now()
              }
            }
          },
          {w:1}, 
          function(db_err) { 
            if (db_err)
              callback(null, ERRORS.DB_ERROR, db_err)
            else 
              Game.findGame(db, params.game, callback)
          }
        )
      }
  }

  // Add or update game
  static updateGame = function(db, params, callback) {
    switch (params.action) {
      case '<new>':
        return Game.updMakeNewGame(db, params, callback)

      case '<name>':
        return Game.updChangeGameName(db, params, callback)
  
      case '<next>':
        return Game.updNextGameState(db, params, callback)

      case '<join>':
        return Game.updJoinGame(db, params, callback)

      case '<stop>':
        return Game.updCancelGame(db, params, callback)

      default:
        return null;
    }
  }

  // Route functions: get game by ID
  static getGame = async (req, res, next) => {
    try {
      console.log('Loading game ' + req.query._id);

      const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
      client.connect(function(db_err) {
        if (db_err)
          return handleErrors(res, ERRORS.DB_ERROR, db_err)

        const db = client.db(dbName);
        Game.findGame(db, req.query, function(gamesFound, err, db_err=null) {
          client.close();
          return handleErrors(res, err, db_err, gamesFound);
        });
      });    
    
    } catch (e) {
      next(e);
    }
  };

  // Route functions: list games
  static getListGames = async (req, res, next) => {
    try {
      console.log('Listing games of user ' + req.query.user_id);

      const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
      client.connect(function(db_err) {
        if (db_err)
          return handleErrors(res, ERRORS.DB_ERROR, db_err)

        const db = client.db(dbName);
        Game.findUserGames(db, req.query, function(gamesFound, err, db_err=null) {
          client.close();
          return handleErrors(res, err, db_err, gamesFound);
        });
      });    
    
    } catch (e) {
      next(e);
    }
  };

  // Route functions: subscribe to games update event stream
  static getUpdatedGames = async (req, res, next) => {
    try {
      console.log('New user session ' + req.query.user_id);

      const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
      client.connect(function(db_err) {
        if (db_err)
          return handleErrors(res, ERRORS.DB_ERROR, db_err)

        const db = client.db(dbName);
        var _since = req.headers['Last-Event-ID'] ? req.headers['Last-Event-ID'] : Date.now();
        res.writeHead(200, {
          'Connection': 'keep-alive',
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        });

        const intervalId = setInterval(() => {
          Game.findUpdates(db, {...req.query, since: _since}, function(changesFound, err, db_err=null) {
            if (err) {
              callback(null, err, db_err);
            }
            else {
              if (!changesFound) {
                res.write(':\n\n')
              }
              else {
                changesFound.map(c => {
                  res.write(`event: ${c.event}\n`);
                  res.write(`id: ${c.ts}\n`);
                  res.write(`data: ${JSON.stringify(c.data)}\n\n`);
                })
              }
              _since = Date.now();
            }
          });
        }, 3000);

        res.write(':\n\n');
        req.on('close', () => {
          console.log('Closing user session ' + req.query.user_id);
          clearInterval(intervalId);
          client.close();
        });
      
        req.on('end', function() {
          console.log('Stream closed for user ' + req.query.user_id);
        });
      });    
    
    } catch (e) {
      next(e);
    }
  };

  // Route functions: create new or update game
  static postUpdateGame = async (req, res, next) => {
    try {
      console.log('Game '+ req.body.game._id + ' action ' + req.body.action);

      const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
      client.connect(function(err) {
        if (err)
          return handleErrors(res, ERRORS.DB_ERROR, db_err);

        const db = client.db(dbName);
        Game.updateGame(db, req.body, function(game, err, db_err=null) {
          client.close();
          return handleErrors(res, err, db_err, game);
        });
      });    
    
    } catch (e) {
      next(e);
    }
  };
}

module.exports = Game;
