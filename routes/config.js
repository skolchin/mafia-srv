// Connection URL
const dbUrl = 'mongodb://kol-pc:27017';

// Database Name
const dbName = 'mafiadb';

// Secret
const secretKey = '<secret>';

// Token lifetime
const tokenExpire = '1d';

// Temporary token expiration time
const tempTokenExpire = '5s';

module.exports = { dbUrl, dbName, secretKey, tokenExpire, tempTokenExpire };

