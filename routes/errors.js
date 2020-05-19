const Enum = require("es6-enum");

// errors
const ERRORS = Enum(
  'DB_ERROR', 
  'USER_NOT_FOUND', 
  'INVALID_PASSWORD'
);

// Transform errors to response
const handleErrors = (name, res, err, db_err) => {
    switch (err) {
      case 0:
        console.log('Success');
        return res.status(200).send({ success: true, name: name });
  
      case ERRORS.DB_ERROR:
        console.log('Error ' + err.description + ': ' + db_err.message);
        return res.status(500).send({ success: false, name: name, message: db_err.message });
  
      case ERRORS.USER_NOT_FOUND:
        console.log('Error ' + err.description + ': user "' + name + '" not found');
        return res.status(404).send({ success: false, name: name, message: 'User not found' });
  
      case ERRORS.INVALID_PASSWORD:
        console.log('Error ' + err.description + ': invalid password for user "' + name + '"');
        return res.status(500).send({ success: false, name: name, message: 'Invalid password' });
          
      default:
        console.log('Error ' + err.description + ': generic error');
        return res.status(500).send({ success: false, name: name, message: 'Generic error' });
    }
  }
  
module.exports = { ERRORS, handleErrors };
