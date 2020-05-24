const express = require('express');
const { MongoClient, ObjectId} = require('mongodb');
const bcrypt = require('bcryptjs')

const { ERRORS, handleErrors } = require('./errors');
const { dbUrl, dbName } = require('./config');
const GameRoutes = require('./game');

class UserRoutes {
  // Check password is valid
  static checkPassword = (pass, hash) => {
    return bcrypt.compareSync(pass, hash);
  }

  // Get user data from request
  static userFromRequest(params) {
    return {
      _id: params._id,
      provider: '',
      name: params.name.trim().toLowerCase(), 
      displayName: params.displayName || '',
      givenName: params.givenName || '',
      familyName: params.familyName || '',
      email: params.email || '',
      password: params.password,
      new_password: params.new_password,
    }
  }

  // Parse image data url
  // data:<content type>;base64,<image data>
  static getImageData(url) {
    const p1 = url.split(':', 2);
    if (p1.length < 2 || p1[0] !== 'data')
      return [ null, null ]
    else {
      const p2 = p1[1].split(';', 2);
      if (p2.length < 2)
        return [ null, null ]
      else {
        const p3 = p2[1].split(',', 2);
        if (p3.length < 2)
          return [null, null]
        else
          return [p2[0], p3[1]]
      }
    }
  }

  // Find a user
  static findUser = function(db, params, callback, dontCheckPassword=false) {
    if (!params.name || !params.name.trim())
      return callback(null, ERRORS.USER_NOT_FOUND)

    db.collection('users').find({'name': params.name.trim().toLowerCase()}).toArray(function(err, docs) {
      if (err)
        callback(null, ERRORS.DB_ERROR, err);
      else {
        console.log("Users found: " + docs.length.toString());
        if (docs.length > 0 && (dontCheckPassword || UserRoutes.checkPassword(params.password, docs[0].password)))
          callback(docs[0], 0);
        else if (docs.length > 0)
          callback(docs[0], ERRORS.INVALID_PASSWORD);
        else
          callback(null, ERRORS.USER_NOT_FOUND);
      }
    });
  }

  // Update password
  static updatePassword = function(db, params, callback) {
    if (!params.new_password)
      return callback(null, ERRORS.EMPTY_PASSWORD)

    UserRoutes.findUser(db, params, function(user, err, db_err=null) {
      if (err)
        return callback(null, err, db_err);

      bcrypt.genSalt(10, function(db_err, salt) {
        if (db_err) 
          return callback(null, ERRORS.DB_ERROR, db_err);

        bcrypt.hash(params.new_password, salt, function(db_err, hash) {
          if (db_err) 
            return callback(null, ERRORS.DB_ERROR, db_err);

          db.collection('users').updateOne(
            {'name': user.name}, 
            {$set: {password: hash}}, 
            {w:1}, 
            function(db_err) { callback(user, db_err ? ERRORS.DB_ERROR : 0, db_err) });
        });
      });
    })
  }

  // Update user profile
  static updateUser = function(db, params, callback) {
    const user = UserRoutes.userFromRequest(params);

    if (!user.name)
      callback(null, ERRORS.USER_NOT_FOUND);
    else if (!user.password && !user.new_password)
      callback(null, ERRORS.EMPTY_PASSWORD);

    const id = user._id;
    delete user._id;

    if (user.new_password) {
      const password = user.new_password;
      delete user.new_password;

      bcrypt.genSalt(10, function(db_err, salt) {
        if (db_err) 
          return callback(null, ERRORS.DB_ERROR, db_err);

        bcrypt.hash(password, salt, function(db_err, hash) {
          if (db_err) 
            return callback(null, ERRORS.DB_ERROR, db_err);

          db.collection('users').updateOne(
            { '_id': new ObjectId(id) }, 
            {$set: {...user, password: hash}}, 
            {w: 1, upsert: true}, 
            function(db_err, result) {
              const upd =  {...user, _id: result.upsertedId ? result.upsertedId._id : id};
              callback(upd, db_err ? ERRORS.DB_ERROR : 0, db_err) 
            });
        });
      });
    }
    else {
      delete user.new_password;
      db.collection('users').updateOne(
        { '_id': new ObjectId(id) }, 
        {$set: user}, 
        {w: 1, upsert: true}, 
        function(db_err, result) { 
          const upd =  {...user, _id: result.upsertedId ? result.upsertedId._id : id};
          callback(upd, db_err ? ERRORS.DB_ERROR : 0, db_err) 
        });
    }
  }

  // Save photo
  static updatePhoto = function(db, params, callback) {
    if (!params.user_id)
      callback(null, ERRORS.USER_NOT_FOUND);

    const id = params._id;
    delete params._id;

    db.collection('photos').updateOne(
      { 'user_id': params.user_id }, 
      {$set: params}, 
      {w: 1, upsert: true}, 
      function(db_err, result) { 
        const upd =  {...params, _id: result.upsertedId ? result.upsertedId._id : id};
        callback(upd, db_err ? ERRORS.DB_ERROR : 0, db_err) 
      });
  }

  // Get user primary photo
  static findPhoto = function(db, params, callback) {
    if (!params.user_id)
      return callback(null, null);

    db.collection('photos').find({'user_id': params.user_id}).toArray(function(db_err, docs) {
      if (db_err)
        callback(null, ERRORS.DB_ERROR, db_err);
      else {
        console.log("Photos found: " + docs.length.toString());
        const photo = docs.length ? docs[0].photo : null;
        callback(photo, photo ? 0 : ERRORS.NOT_FOUND);
      }
    });
  }

  // Route functions: login
  static postLoginUser = async (req, res, next) => {
    try {
      console.log('Logging on user "' + req.body.name + '"');

      const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
      client.connect(function(db_err) {
        if (db_err) {
          return handleErrors(res, ERRORS.DB_ERROR, db_err);
        }
        const db = client.db(dbName);
        UserRoutes.findUser(db, req.body, function(user, err, db_err=null) {
          if (err || !req.body.with_games)
            return handleErrors(res, err, db_err, user);
          else {
            GameRoutes.findUserGames(db, {...req.body, user_id: user._id}, function(games, err, db_err=null) {
              client.close();
              return handleErrors(res, err, db_err, {user: user, games: games});
            });
          }
        });
      });    
    
    } catch (e) {
      next(e);
    }
  };

  // Route functions: set password
  static postSetPassword = async (req, res, next) => {
    try {
      console.log('Changing password for user "' + req.body.name + '"');

      const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
      client.connect(function(db_err) {
        if (db_err) {
          return handleErrors(res, ERRORS.DB_ERROR, db_err);
        }
        const db = client.db(dbName);
        UserRoutes.updatePassword(db, req.body, function(user, err, db_err=null) {
          client.close();
          return handleErrors(res, err, db_err, {name: req.body.name});
        });
      });    
    
    } catch (e) {
      next(e);
    }
  };

  // Route functions: create or update user profile
  static postUpdateUser = async (req, res, next) => {
    try {
      console.log('Updating user "' + req.body.name + '"');

      const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
      client.connect(function(db_err) {
        if (db_err) {
          return handleErrors(res, ERRORS.DB_ERROR, db_err);
        }
        const db = client.db(dbName);
        UserRoutes.updateUser(db, req.body, function(user, err, db_err=null) {
          client.close();
          return handleErrors(res, err, db_err, user);
        });
      });    
    
    } catch (e) {
      next(e);
    }
  };

  // Route functions: check name uniqueness
  static getCheckName = async (req, res, next) => {
    try {
      console.log('Checking unique name "' + req.body.name + '"');

      const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
      client.connect(function(db_err) {
        if (db_err) {
          return handleErrors(res, ERRORS.DB_ERROR, db_err);
        }
        const db = client.db(dbName);
        UserRoutes.findUser(db, req.query, function(user, err, db_err=null) {
          client.close();
          return handleErrors(res, err, db_err, {name: req.body.name});
        }, true);
      });    
    
    } catch (e) {
      next(e);
    }
  };

  // Route functions: get photo (GET gunction)
  static getPhoto = async (req, res, next) => {
    try {
      console.log('Loading photo for user ' + req.query.user_id);

      const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
      client.connect(function(db_err) {
        if (db_err) {
          return handleErrors(res, ERRORS.DB_ERROR, db_err);
        }
        const db = client.db(dbName);
        UserRoutes.findPhoto (db, req.query, function(photo, err, db_err=null) {
          client.close();
          if (err)
            return handleErrors(res, err, db_err, {user_id: req.query.user_id});
          else {
            const [type, data] = UserRoutes.getImageData(photo);
            const img = Buffer.from(data, 'base64');
            res.writeHead(200, {
              'Content-Type': type,
              'Content-Length': img.length
            });
            res.end(img);
          }
        });
      });    

    } catch (e) {
      next(e);
    }
  }  

  // Route functions: update photo
  static postUpdatePhoto = async (req, res, next) => {
    try {
      console.log('Changing photo for user ' + req.body.user_id);

      const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
      client.connect(function(db_err) {
        if (db_err) {
          return handleErrors(res, ERRORS.DB_ERROR, db_err);
        }
        const db = client.db(dbName);
        UserRoutes.updatePhoto(db, req.body, function(photo, err, db_err=null) {
          client.close();
          return handleErrors(res, err, db_err, {user_id: req.body.user_id});
        });
      });    
    
    } catch (e) {
      next(e);
    }
  };

};


module.exports = UserRoutes;

