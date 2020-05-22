const express = require('express');
const MongoClient = require('mongodb').MongoClient;

const { ERRORS, handleErrors } = require('./errors');
const { dbUrl, dbName } = require('./config');

class UserRoutes {
  // Check password is valid (simple)
  static checkPassword = (given_pass, stored_pass) => {
    return given_pass === stored_pass;
  }

  // Find a user
  static findUser = function(db, req, callback, dontCheckPassword=false) {
    if (!req.body.name || !req.body.name.trim())
      return callback(user, ERRORS.USER_NOT_FOUND)

    db.collection('users').find({'name': req.body.name.trim().toLowerCase()}).toArray(function(err, docs) {
      if (err)
        callback(null, ERRORS.DB_ERROR, err);
      else {
        console.log("Users found: " + docs.length.toString());
        if (docs.length > 0 && (dontCheckPassword || UserRoutes.checkPassword(req.body.password, docs[0].password)))
          callback(docs[0], 0);
        else if (docs.length > 0)
          callback(docs[0], ERRORS.INVALID_PASSWORD);
        else
          callback(null, ERRORS.USER_NOT_FOUND);
      }
    });
  }

  // Update password
  static updatePassword = function(db, req, callback) {
    UserRoutes.findUser(db, req, function(user, err, db_err=null) {
      if (err)
        callback(null, err, db_err);
      else {
        db.collection('users').updateOne(
          {'name': user.name}, 
          {$set:{password:req.body.new_password}}, 
          {w:1}, 
          function(db_err) { callback(user, db_err ? ERRORS.DB_ERROR : 0, db_err) });
      }
    })
  }

  // Update user profile
  static updateUser = function(db, req, callback) {
    if (req.body._id) {
      // Existing
      UserRoutes.findUser(db, req, function(user, err, db_err=null) {
        if (err)
          callback(null, err, db_err);
        else {
          if (req.body.new_password) {
            req.body.password = req.body.new_password;
            delete req.body.new_password;
          }
          const id = req.body._id;
          delete req.body._id;
          db.collection('users').updateOne(
            {'_id': id}, 
            {$set: req.body}, 
            {w:1}, 
            function(db_err) { callback(user, db_err ? ERRORS.DB_ERROR : 0, db_err) });
        }
      })
    }
    else {
      // New
      if (!req.body.name || !req.body.name.trim())
        callback(null, ERRORS.USER_NOT_FOUND)
      else if (!req.body.password && !req.body.new_password)
        callback(null, ERRORS.EMPTY_PASSWORD)
      else {
        db.collection('users').find({'name': req.body.name.trim().toLowerCase()}).toArray(function(db_err, docs) {
          if (db_err)
            callback(null, ERRORS.DB_ERROR, db_err);
          else {
            if (docs.length > 0)
              callback(docs[0], ERRORS.NAME_NOT_UNIQUE);
            else {
              const user = {
                provider: '',
                name: req.body.name.trim().toLowerCase(), 
                displayName: req.body.displayName || '',
                givenName: req.body.givenName || '',
                familyName: req.body.familyName || '',
                email: req.body.email || '',
                emails: [req.body.email || ''],
                photos: req.body.photos || [''],
                password: req.body.password || req.body.new_password,
              }
              db.collection('users').insert(
                user,
                {w:1}, 
                function(db_err) { callback(user, db_err ? ERRORS.DB_ERROR : 0, db_err) });
            }
          }
        });
    
      }
    }
  }

  // Route functions: login
  static routeLoginUser = async (req, res, next) => {
    try {
      console.log('Logging on user "' + req.body.name + '"');

      const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
      client.connect(function(db_err) {
        if (db_err) {
          return handleErrors(res, ERRORS.DB_ERROR, db_err);
        }
        const db = client.db(dbName);
        UserRoutes.findUser(db, req, function(user, err, db_err=null) {
          client.close();
          return handleErrors(res, err, db_err, user);
        });
      });    
    
    } catch (e) {
      next(e);
    }
  };

  // Route functions: set password
  static routeSetPassword = async (req, res, next) => {
    try {
      console.log('Changing password for user "' + req.body.name + '"');

      const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
      client.connect(function(db_err) {
        if (db_err) {
          return handleErrors(res, ERRORS.DB_ERROR, db_err);
        }
        const db = client.db(dbName);
        UserRoutes.updatePassword(db, req, function(user, err, db_err=null) {
          client.close();
          return handleErrors(res, err, db_err, {name: req.body.name});
        });
      });    
    
    } catch (e) {
      next(e);
    }
  };

  // Route functions: create or update user profile
  static routeUpdateUser = async (req, res, next) => {
    try {
      console.log('Updating user "' + req.body.name + '"');

      const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
      client.connect(function(db_err) {
        if (db_err) {
          return handleErrors(res, ERRORS.DB_ERROR, db_err);
        }
        const db = client.db(dbName);
        UserRoutes.updateUser(db, req, function(user, err, db_err=null) {
          client.close();
          return handleErrors(res, err, db_err, user);
        });
      });    
    
    } catch (e) {
      next(e);
    }
  };

  // Route functions: check name uniqueness
  static routeCheckName = async (req, res, next) => {
    try {
      console.log('Checking unique name "' + req.body.name + '"');

      const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
      client.connect(function(db_err) {
        if (db_err) {
          return handleErrors(res, ERRORS.DB_ERROR, db_err);
        }
        const db = client.db(dbName);
        UserRoutes.findUser(db, req, function(user, err, db_err=null) {
          client.close();
          return handleErrors(res, err, db_err, {name: req.body.name});
        }, true);
      });    
    
    } catch (e) {
      next(e);
    }
  };
};

module.exports = { UserRoutes }
