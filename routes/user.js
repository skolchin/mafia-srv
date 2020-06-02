const { MongoClient, ObjectId} = require('mongodb');
const bcrypt = require('bcryptjs')

const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwt = require('jsonwebtoken');
const assert = require('assert');

const { ERRORS, handleErrors, errorMessage } = require('./errors');
const { dbUrl, dbName, secretKey } = require('./config');

class User {
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

  // Load a user by id
  static loadUser = function(db, params, callback) {
    if (!params._id)
      return callback(null, ERRORS.USER_NOT_FOUND)

    db.collection('users').find({'_id': ObjectId(params._id)}).toArray((db_err, docs) => {
      if (db_err)
        callback(null, ERRORS.DB_ERROR, err);
      else {
        if (!docs.length)
          callback(null, ERRORS.USER_NOT_FOUND);
        else
          callback({user: docs[0]}, 0);
      }
    });
  }

  // Load a user by id - self contained version
  static loadUserExt = function(id, callback) {
    const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
    client.connect(function(db_err) {
      if (db_err)
        return callback(null, ERRORS.DB_ERROR, db_err);

      const db = client.db(dbName);
      User.loadUser(db, {_id: id}, (userGames, err, db_err=null) => {
          client.close();
          callback(userGames, err, db_err);
        });
    });    
  };

  // Find a user by name and, optionally, load the games
  static findUser = function(db, params, callback, dontCheckPassword=false) {
    if (!params.name || !params.name.trim())
      return callback(null, ERRORS.USER_NOT_FOUND)

    const find_callback = (db_err, docs) => {
      if (db_err)
        callback(null, ERRORS.DB_ERROR, err);
      else {
        console.log("Users found: " + docs.length.toString());
        if (!docs.length)
          callback(null, ERRORS.USER_NOT_FOUND);
        else if (!dontCheckPassword && !User.checkPassword(params.password, docs[0].password))
          callback(null, ERRORS.INVALID_PASSWORD);
        else {
          const _games = docs[0].games;
          const {games: _, ..._user } = docs[0];
          callback({user: _user, games: _games}, 0);
        }
      }
    }
    if (!params.withGames) {
      db.collection('users').find({'name': params.name.trim().toLowerCase()}).toArray(find_callback);
    }
    else {
      db.collection('users').aggregate(
        [{$match: {
          name: params.name.trim().toLowerCase()
        }}, {$lookup: {
          from: 'games',
          localField: '_id',
          foreignField: 'leader._id',
          as: 'games_1'
        }}, {$lookup: {
          from: 'games',
          localField: '_id',
          foreignField: 'members._id',
          as: 'games_2'
        }}, {$lookup: {
          from: 'games',
          pipeline: [
            {$match: {status: 'start'}},
          ],
          as: 'games_3'
        }}, {$set: {
          games: {
            $setDifference: [
              { $concatArrays: [
                "$games_1", 
                "$games_2", 
                "$games_3"
              ]
              }, []
            ]
          },
        }}, {$unset: [
          "games_1", "games_2", "games_3"
        ]}])
        .toArray(find_callback);
    }
  }

  // Find a user by name - self-contained
  static findUserExt = function(name, password, callback, dontCheckPassword=false, withGames=false) {
    const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
    client.connect(function(db_err) {
      if (db_err)
        return callback(null, ERRORS.DB_ERROR, db_err);

      const db = client.db(dbName);
      User.findUser(db, 
        {
          name: name, 
          password: password, 
          withGames: withGames
        }, 
        (userGames, err, db_err=null) => {
          client.close();
          callback(userGames, err, db_err);
        }, 
        dontCheckPassword);
    });    
};

  // Update password
  static updatePassword = function(db, params, callback) {
    if (!params.new_password || (!params._id && !params.name) )
      return callback(null, ERRORS.EMPTY_PASSWORD)

    bcrypt.genSalt(10, function(db_err, salt) {
      if (db_err) 
        return callback(null, ERRORS.DB_ERROR, db_err);

      bcrypt.hash(params.new_password, salt, function(db_err, hash) {
        if (db_err) 
          return callback(null, ERRORS.DB_ERROR, db_err);

        const user = params._id ? {_id: ObjectId(params._id)} : {name: params.name};
        db.collection('users').updateOne(
          user, 
          {$set: {password: hash}}, 
          {w:1}, 
          function(db_err) { callback({user: {...user, password: hash}}, db_err ? ERRORS.DB_ERROR : 0, db_err) });
      });
    })
  }

  // Add new user profile
  static addUser = function(db, params, callback) {
    if (!params.name || !params.name.trim())
      return callback(null, ERRORS.EMPTY_NAME);
    if (!params.password)
      return callback(null, ERRORS.EMPTY_PASSWORD);

    bcrypt.genSalt(10, function(db_err, salt) {
      if (db_err) 
        return callback(null, ERRORS.DB_ERROR, db_err);

      bcrypt.hash(params.password, salt, function(db_err, hash) {
        if (db_err) 
          return callback(null, ERRORS.DB_ERROR, db_err);

        const user = {
            provider: '',
            name: params.name.trim().toLowerCase(), 
            displayName: params.displayName || '',
            givenName: params.givenName || '',
            familyName: params.familyName || '',
            email: params.email || '',
            password: hash,
            games: [],
            history: [],
        }
        db.collection('users').insertOne(
          user, 
          {w: 1}, 
          function(db_err) {
            if (db_err) 
              callback(null, db_err.code === 11000 ? ERRORS.NAME_NOT_UNIQUE : ERRORS.DB_ERROR, db_err)
            else
              callback({user: user}, 0, db_err);
          });
      });
    });
  }

  // Update user profile
  static updateUser = function(db, params, callback) {
    const user = params;

    if (!user._id)
      return callback(null, ERRORS.USER_NOT_FOUND);

    const id = user._id;
    delete user._id;
    delete user.password;

    if (user.new_password) {
      const new_password = user.new_password;
      delete user.new_password;

      bcrypt.genSalt(10, function(db_err, salt) {
        if (db_err) 
          return callback(null, ERRORS.DB_ERROR, db_err);

        bcrypt.hash(new_password, salt, function(db_err, hash) {
          if (db_err) 
            return callback(null, ERRORS.DB_ERROR, db_err);

          db.collection('users').updateOne(
            { '_id': new ObjectId(id) }, 
            {$set: {...user, password: hash}}, 
            {w: 1, upsert: true}, 
            function(db_err, result) {
              const upd =  {...user, _id: result.upsertedId ? result.upsertedId._id : id, password: hash};
              callback({user: upd}, db_err ? ERRORS.DB_ERROR : 0, db_err) 
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
          callback({user: upd}, db_err ? ERRORS.DB_ERROR : 0, db_err) 
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
      { user_id: ObjectId(params.user_id) }, 
      {$set: {...params, user_id: ObjectId(params.user_id)}}, 
      {w: 1, upsert: true}, 
      function(db_err, result) { 
        const upd =  {...params, _id: result.upsertedId ? result.upsertedId._id : id};
        callback({photo: upd}, db_err ? ERRORS.DB_ERROR : 0, db_err) 
      });
  }

  // Get user primary photo
  static findPhoto = function(db, params, callback) {
    if (!params.user_id)
      return callback(null, null);

    db.collection('photos').find({'user_id': ObjectId(params.user_id)}).toArray(function(db_err, docs) {
      if (db_err)
        callback(null, ERRORS.DB_ERROR, db_err);
      else {
        const photo = docs.length ? docs[0].photo : null;
        callback({photo: photo}, photo ? 0 : ERRORS.NOT_FOUND);
      }
    });
  }

  // Route functions: login
  static postLoginUser = async (req, res, next) => {
    try {
      console.log('Logging on user "' + req.body.name + '"');
      const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
      client.connect(function(db_err) {
        if (db_err)
          return handleErrors(res, ERRORS.DB_ERROR, db_err);

        const db = client.db(dbName);
        User.findUser(db, req.body, function(userGames, err, db_err=null) {
          client.close();
          if (err)
            return handleErrors(res, err, db_err, {name: req.body.name});

          const token = jwt.sign({_id: userGames.user._id}, secretKey);
          return res.status(200).send({ success: true, token: 'JWT ' + token, data: userGames });
        });
      });
    } catch (e) {
      next(e);
    }
  };

  // Route functions: add user profile
  static postAddUser = async (req, res, next) => {
    try {
      const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
      console.log('Creating user "' + req.body.name + '"');
      client.connect(function(db_err) {
        if (db_err)
          return handleErrors(res, ERRORS.DB_ERROR, db_err);

        const db = client.db(dbName);
        User.addUser(db, req.body, function(userGames, err, db_err=null) {
          client.close();
          if (err)
            return handleErrors(res, err, db_err, {name: req.body.name});

          const token = jwt.sign({_id: userGames.user._id}, secretKey);
          return res.status(200).send({ success: true, token: 'JWT ' + token, data: userGames });
        });
      })
    } catch (e) {
      next(e);
    }
  };

  // Route functions: set password
  static postSetPassword = async (req, res, next) => {
    try {
      assert(req.user && req.user._id, 'Invalid API call');
      if ((req.body._id && req.body._id !== req.user._id.toString()) || 
      (req.body.name && req.body.name !== req.user.name))
        return handleErrors(res, ERRORS.NOT_YOU);

      console.log('Changing password for user ' + (req.body.name || req.body._id) + '');

      const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
      client.connect(function(db_err) {
        if (db_err)
          return handleErrors(res, ERRORS.DB_ERROR, db_err);

        const db = client.db(dbName);
        User.updatePassword(db, req.body, function(userGames, err, db_err=null) {
          client.close();
          return handleErrors(res, err, db_err, userGames);
        });
      });    
    
    } catch (e) {
      next(e);
    }
  };

  // Route functions: update user profile
  static postUpdateUser = async (req, res, next) => {
    try {
      assert(req.user && req.user._id, 'Invalid API call');
      if (req.body._id !== req.user._id.toString())
        return handleErrors(res, ERRORS.NOT_YOU);

      const client = new MongoClient(dbUrl, {useNewUrlParser: true, useUnifiedTopology: true});
      console.log('Updating user ' + req.body._id + '');
      client.connect(function(db_err) {
        if (db_err) {
          return handleErrors(res, ERRORS.DB_ERROR, db_err);
        }
        const db = client.db(dbName);
        User.updateUser(db, req.body, function(userGames, err, db_err=null) {
          client.close();
          return handleErrors(res, err, db_err, userGames);
        });
      })
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
        User.findPhoto (db, req.query, function(photo, err, db_err=null) {
          client.close();
          if (err)
            return handleErrors(res, err, db_err, {user_id: req.query.user_id});
          else {
            const [type, data] = User.getImageData(photo.photo);
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
        User.updatePhoto(db, req.body, function(photo, err, db_err=null) {
          client.close();
          return handleErrors(res, err, db_err, {user_id: req.body.user_id});
        });
      });    
    
    } catch (e) {
      next(e);
    }
  };

  // Auth function: establish passport strategy
  static authStrategy = () => {
    return new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromExtractors([
          ExtractJwt.fromAuthHeaderAsBearerToken('jwt'),
          ExtractJwt.fromUrlQueryParameter('token')
        ]),
        secretOrKey: secretKey,
      }, (jwt_payload, done) => {
        if (!jwt_payload._id)
          return done(-1, false, {message: errorMessage(ERRORS.USER_NOT_FOUND)})
        else {
          User.loadUserExt(jwt_payload._id, function(userGames, err, db_err=null) {
            if (err) 
              return done(err, false, { message: errorMessage(err, db_err) })
            else
              return done(null, userGames.user);
          });
        }
      }
    )
  }

  // Auth function: user-to-session serialization
  static serializeUser = (user, done) => {
    done(null, user._id ? user._id : user.user._id);
  };
  
  // Auth function: session-to-user deserialization
  static deserializeUser = (id, done) => {
    //TODO: id check
    done(null, {_id: id});
  };
  
};

module.exports = User;

