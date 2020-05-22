//const Enum = require("es6-enum");

// errors
class ERRORS {
  static DB_ERROR = 1
  static USER_NOT_FOUND = 2
  static INVALID_PASSWORD = 3
  static EMPTY_PASSWORD = 4
  static NAME_NOT_UNIQUE = 5

  static MESSAGES = [
    null,
    null,
    'User not found',
    'Invalid password',
    'Password is empty'
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
  
      default:
        console.log('Error ' + err.toString() + ': ' + ERRORS.MESSAGES[err].toLowerCase());
        return res.status(200).send({  success: false, error: err, message: ERRORS.MESSAGES[err], data: result });
    }
  }
  
module.exports = { ERRORS, handleErrors };
