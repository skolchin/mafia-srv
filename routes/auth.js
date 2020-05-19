const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

// Connection URL
const url = 'mongodb://localhost:27017';

// Database Name
const dbName = 'mafiadb';

const router = express.Router();
const loginUser = async (req, res, next) => {
  try {
    console.log('Login requested');
    console.log('  Username: ' + req.body.name);
    console.log('  Password: ' + req.body.password);

    const findUsers = function(db, callback) {
      const collection = db.collection('users');
      collection.find({'name': req.body.name}).toArray(function(err, docs) {
        assert.equal(err, null);
        console.log("Found users: " + docs.length.toString());
        callback(docs);
      });
    }

    const client = new MongoClient(url, {useNewUrlParser: true, useUnifiedTopology: true});
    client.connect(function(err) {
      if (err) {
        return res.status(500).send({ succes: false, message: err.message });
      }
    
      console.log("Connected to server");
      const db = client.db(dbName);

      findUsers(db, function(usersFound) {
        client.close();
        if (usersFound.length > 0) {
          return res.status(200).send({ success: true });
        }
        else {
          return res.status(500).send({ success: false, message: 'User not found' });
        }
      });
    });    
   
  } catch (e) {
    next(e);
  }
};
router
  .route('/api/v1/auth/')
  .post(loginUser);

module.exports = router;