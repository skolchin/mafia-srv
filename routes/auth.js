const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const { ERRORS, handleErrors } = require('./errors');
const router = express.Router();

// Connection URL
const url = 'mongodb://192.168.0.65:27017';

// Database Name
const dbName = 'mafiadb';

// Check password is valid (simple)
const checkPassword = (given_pass, stored_pass) => {
  return given_pass === stored_pass;
}

// Find a user and check its password
const findUser = function(db, req, callback) {
  const collection = db.collection('users');
  collection.find({'name': req.body.name}).toArray(function(err, docs) {
    if (err)
      callback(null, ERRORS.DB_ERROR, err);
    else {
      console.log("Users found: " + docs.length.toString());
      if (docs.length > 0 && checkPassword(req.body.password, docs[0].password))
        callback(docs[0], 0);
      else if (docs.length > 0)
        callback(docs[0], ERRORS.INVALID_PASSWORD);
      else
        callback(null, ERRORS.USER_NOT_FOUND);
    }
  });
}

// Update password
const updatePassword = function(db, req, callback) {
  findUser(db, req, function(user, err, db_err=null) {
    if (err)
      callback(null, err, db_err);
    else {
      const collection = db.collection('users');
      collection.updateOne(
        {'name': user.name}, 
        {$set:{password:req.body.new_password}}, 
        {w:1}, 
        function(db_err) { callback(user, db_err ? ERRORS.DB_ERROR : 0, db_err) });
    }
  })
}

// Route functions: login
const loginUser = async (req, res, next) => {
  try {
    console.log('Logging on user "' + req.body.name + '"');

    const client = new MongoClient(url, {useNewUrlParser: true, useUnifiedTopology: true});
    client.connect(function(err) {
      if (err) {
        return res.status(500).send({ succes: false, message: err.message });
      }
      const db = client.db(dbName);
      findUser(db, req, function(user, err, db_err=null) {
        client.close();
        return handleErrors(req.body.name, res, err, db_err);
      });
    });    
   
  } catch (e) {
    next(e);
  }
};

// Route functions: set password
const setPassword = async (req, res, next) => {
  try {
    console.log('Changing password for user "' + req.body.name + '"');

    const client = new MongoClient(url, {useNewUrlParser: true, useUnifiedTopology: true});
    client.connect(function(err) {
      if (err) {
        return res.status(500).send({ succes: false, name: req.body.name, message: err.message });
      }
    
      console.log("Connected to server");
      const db = client.db(dbName);
      updatePassword(db, req, function(user, err, db_err=null) {
        client.close();
        return handleErrors(req.body.name, res, err, db_err);
      });
    });    
   
  } catch (e) {
    next(e);
  }
};

router
  .route('/api/v1/auth/')
  .post(loginUser);

router
  .route('/api/v1/psw/')
  .post(setPassword);

module.exports = router;
