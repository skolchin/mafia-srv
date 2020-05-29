const Enum = require("es6-enum");

// errors
const ERRORS = Enum(
  'DB_ERROR',
  'AUTH_REQUIRED',
  'USER_NOT_FOUND',
  'INVALID_PASSWORD',
  'EMPTY_PASSWORD',
  'NAME_NOT_UNIQUE',
  'NOT_FOUND',
  'GAME_NOT_FOUND',
  'EMPTY_GAME_NAME',
  'INVALID_GAME_STATUS',
  'NOT_ENOUGHT_MEMBERS',
);

const MESSAGES = [
  [ ERRORS.DB_ERROR, 'Database error' ],
  [ ERRORS.AUTH_REQUIRED, 'Authentication required'],
  [ ERRORS.USER_NOT_FOUND, 'User not found' ],
  [ ERRORS.INVALID_PASSWORD, 'Invalid password' ],
  [ ERRORS.EMPTY_PASSWORD, 'Password is empty' ],
  [ ERRORS.NAME_NOT_UNIQUE, 'User name is not unique' ],
  [ ERRORS.NOT_FOUND, null ],
  [ ERRORS.GAME_NOT_FOUND, 'Game not found' ],
  [ ERRORS.EMPTY_GAME_NAME, 'Game name cannot be empty' ],
  [ ERRORS.INVALID_GAME_STATUS, 'Game status is invalid or final' ],
  [ ERRORS.NOT_ENOUGHT_MEMBERS, 'Not enought members to start a game' ],
]

const errorMessage = function(err, db_err=null) {
  if (!err)
    return null;
  else if (err === ERRORS.DB_ERROR && db_err)
    return db_err.message;
  else {
    const m = MESSAGES.find(m => m[0] === err);
    return m ? m[1] : 'Generic error';
  }
}

// Transform errors to response
const handleErrors = (res, err, db_err, result=null) => {
    switch (err) {
      case 0:
      case undefined:
        console.log('Success');
        return res.status(200).send({success: true, data: result });
  
      case ERRORS.DB_ERROR:
        console.log('Error ' + err.description + ': ' + db_err.message);
        return res.status(200).send({ success: false, error: err, message: db_err.message, data: result });
  
      case ERRORS.AUTH_REQUIRED:
        console.log('Authentication required');
        return res.status(403).send();
  
      case ERRORS.NOT_FOUND:
        console.log('Not found');
        return res.status(404).send();
  
      default:
        const msg = errorMessage(err);
        console.log('Error ' + err.description + ': ' + msg.toLowerCase());
        return res.status(200).send({  success: false, error: err.description, message: msg, data: result });
    }
  }
  
module.exports = { ERRORS, handleErrors, errorMessage };
