//const Enum = require("es6-enum");

// errors
class ERRORS {
  static DB_ERROR = 1
  static USER_NOT_FOUND = 2
  static INVALID_PASSWORD = 3
  static EMPTY_PASSWORD = 4
  static NAME_NOT_UNIQUE = 5
  static NOT_FOUND = 5
  static GAME_NOT_FOUND = 6
  static EMPTY_GAME_NAME = 7
  static INVALID_GAME_STATUS = 8
  static NOT_ENOUGHT_MEMBERS = 9

  static MESSAGES = [
    null,
    null,
    'User not found',
    'Invalid password',
    'Password is empty',
    null,
    'Game not found',
    'Game name cannot be empty',
    'Game status is invalid or final',
    'Not enought members to start a game'
  ]
};

// Transform errors to response
const handleErrors = (res, err, db_err, result=null) => {
    switch (err) {
      case 0:
        console.log('Success');
        return res.status(200).send({success: true, data: result });
  
      case ERRORS.DB_ERROR:
        console.log('Error ' + err.toString() + ': ' + db_err.message);
        return res.status(200).send({ success: false, error: err, message: db_err.message, data: result });
  
      case ERRORS.NOT_FOUND:
        console.log('Not found');
        return res.status(404).send();
  
      default:
        console.log('Error ' + err.toString() + ': ' + ERRORS.MESSAGES[err].toLowerCase());
        return res.status(200).send({  success: false, error: err, message: ERRORS.MESSAGES[err], data: result });
    }
  }
  
module.exports = { ERRORS, handleErrors };
