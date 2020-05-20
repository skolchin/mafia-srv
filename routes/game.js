const express = require('express');
const MongoClient = require('mongodb').MongoClient;

const { ERRORS, handleErrors } = require('./errors');
const { dbUrl, dbName } = require('./config');

// Fill calculated fields of game structure
const populateFields = (game) => {

}

// Find games
const findGames = function(db, req, callback) {
  db.collection('games').find(
    {
      $or: [
        { 'leader.user_id': req.query.user_id },
        { 'members.user_id': req.query.user_id }
      ]
    }
  ).toArray(function(err, docs) {
    if (err)
      callback(null, ERRORS.DB_ERROR, err);
    else {
      console.log("Games found: " + docs.length.toString());
      callback(docs, 0);
    }
  });
}
  
// Add game
const addGame = function(db, req, callback) {
  db.collection('games').insertOne(
    {
      name: req.body.name || '<New game>',
      started: Date.now(),
      round: null,
      status: 'new',
      period: null,
      voting: null,
      citizenState: [0, 0],
      mafiaState: [0, 0],
      total: [1, 1],
      leader: {
        user_id: req.body.leader_id,
        name: req.body.leader_name,
      },
      members: [
        {
          user_id: req.body.leader_id,
          name: req.body.leader_name,
          role: 'leader',
          alive: true,
        }
      ],
      created: Date.now(),
      modified: Date.now(),
    },
    {w:1}, 
    function(db_err) { callback(null, db_err ? ERRORS.DB_ERROR : 0, db_err) }
  )
}

// Route functions: list games
const routeListGames = async (req, res, next) => {
  try {
    console.log('Listing games of user ' + req.query.user_id);

    const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
    client.connect(function(err) {
      if (err) {
        return res.status(500).send({ succes: false, message: err.message });
      }
      const db = client.db(dbName);
      findGames(db, req, function(gamesFound, err, db_err=null) {
        client.close();
        return handleErrors(res, err, db_err, gamesFound);
      });
    });    
   
  } catch (e) {
    next(e);
  }
};

// Route functions: new game
const routeNewGame = async (req, res, next) => {
  try {
    console.log('New game of user ' + req.body.user_id);

    const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
    client.connect(function(err) {
      if (err) {
        return res.status(500).send({ succes: false, message: err.message });
      }
      const db = client.db(dbName);
      addGame(db, req, function(gamesFound, err, db_err=null) {
        client.close();
        return handleErrors(res, err, db_err, gamesFound);
      });
    });    
   
  } catch (e) {
    next(e);
  }
};

module.exports = { routeListGames, routeNewGame }
