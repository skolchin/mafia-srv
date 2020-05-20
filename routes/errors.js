const Enum = require("es6-enum");

// errors
const ERRORS = Enum(
  'DB_ERROR', 
  'USER_NOT_FOUND', 
  'INVALID_PASSWORD'
);

// Transform errors to response
const handleErrors = (res, err, db_err, result=null) => {
    switch (err) {
      case 0:
        console.log('Success');
        return res.status(200).send({success: true, data: result });
  
      case ERRORS.DB_ERROR:
        console.log('Error ' + err.description + ': ' + db_err.message);
        return res.status(500).send({ success: false, message: db_err.message, data: result });
  
      case ERRORS.USER_NOT_FOUND:
        console.log('Error ' + err.description + ': user not found');
        return res.status(404).send({ success: false, message: 'User not found', data: result });
  
      case ERRORS.INVALID_PASSWORD:
        console.log('Error ' + err.description + ': invalid password');
        return res.status(500).send({ success: false, message: 'Invalid password', data: result });
          
      default:
        console.log('Error ' + err.description + ': generic error');
        return res.status(500).send({  success: false,  message: 'Generic error', data: result });
    }
  }
  
module.exports = { ERRORS, handleErrors };
