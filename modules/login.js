const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const winston = require('winston');
const Buffer = require('buffer').Buffer;

exports.setup = function (mstream, program) {
  // Crypto Config
  const hashConfig = {
    hashBytes: 32,
    saltBytes: 16,
    iterations: 15000,
    encoding: 'base64'
  };

  // mstream.post('/change-password-request', (req, res) => {
  //   // Get email address from request
  //     // validate email against user array
  //   // Generate change password token
  //   // Invalidate all other change password tokens
  //   // Email the user the token
  //   res.status(500).json( {error: 'Coming Soon'} );
  // });
  // mstream.post('/change-password', (req, res) => {
  //   // Check token
  //   // Get new password
  //   // Hash password and update user array
  //   res.status(500).json( {error: 'Coming Soon'} );
  // });
  // mstream.post('/delete-user', (req,res) => {
  //   // Removes all user info
  //   res.status(500).json( {error: 'Coming Soon'} );
  // });
  // mstream.post('/add-user', (req,res) => {
  //   // Add a user
  //   res.status(500).json( {error: 'Coming Soon'} );
  // });

  // Loop through users and setup passwords
  for (let username in program.users) {
    if(!program.users[username]["password"]){
      winston.error(`User ${username} is missing password and will not be able to log in!`);
      continue;
    }

    // If the user already has a salt, it means the password is hashed and can be used as is
    if (program.users[username].salt) {
      program.users[username].salt = Buffer.from(program.users[username].salt);
      continue;
    }

    generateSaltedPassword(username, program.users[username]["password"]);
  }

  function generateSaltedPassword(username, password) {
    crypto.randomBytes(hashConfig.saltBytes, (err, salt) => {
      if (err) {
        winston.error(`Failed to hash password for user ${username}`);
        return;
      }

      crypto.pbkdf2(password, salt, hashConfig.iterations, hashConfig.hashBytes, 'sha512', (err, hash) => {
        if (err) {
          winston.error(`Failed to hash password for user ${username}: ${err}`);
          return;
        }
        program.users[username]['password'] = Buffer.from(hash).toString('hex');
        program.users[username]['salt'] = salt;
      });
    });
  }

  // Failed Login Attempt
  mstream.get('/login-failed', (req, res) => {
    // Wait before sending the response
    setTimeout(() => { res.status(401).json({ error: 'Try Again' }); }, 800);
  });

  mstream.get('/access-denied', (req, res) => {
    res.status(403).json({ error: 'Access Denied' });
  });

  // Authenticate User
  mstream.post('/login', (req, res) => {
    if (!req.body.username || !req.body.password) {
      return res.redirect('/login-failed');
    }

    const username = req.body.username;
    const password = req.body.password;

    // Check is user is in array
    if (!program.users[username] || !program.users[username].password || !program.users[username].salt) {
      return res.redirect('/login-failed');
    }

    // Check is password is correct
    crypto.pbkdf2(password, program.users[username].salt, hashConfig.iterations, hashConfig.hashBytes, 'sha512', (err, verifyHash) => {
      if (err) {
        winston.error(`Failed to hash password for user ${username}: ${err}`);        
        return res.redirect('/login-failed');
      }

      if (Buffer.from(verifyHash).toString('hex') !== program.users[username]['password']) {
        return res.redirect('/login-failed');
      }

      res.json({
        vpaths: program.users[username].vpaths,
        token: jwt.sign({ username: username }, program.secret) // Make the token
      });
    });
  });

  // Middleware that checks for token
  mstream.use((req, res, next) => {
    // check header or url parameters or post parameters for token
    const token = req.body.token || req.query.token || req.headers['x-access-token'];
    if (!token) {
      return res.redirect('/access-denied');
    }

    // verifies secret and checks exp
    jwt.verify(token, program.secret, (err, decoded) => {
      if (err) {
        return res.redirect('/access-denied');
      }

      // Check if share token
      // User may access those files and no others
      if (decoded.shareToken && decoded.shareToken === true) {
        // We limit the endpoints to download and anythign in the allowedFiles array
        if (req.path !== '/download' && decoded.allowedFiles.indexOf(decodeURIComponent(req.path).slice(7)) === -1) {
          return res.redirect('/access-denied');
        }
        req.allowedFiles = decoded.allowedFiles;
        next();
        return;
      }

      // Check for any hardcoded restrictions baked right into token
      if (decoded.restrictedFunctions && decoded.restrictedFunctions.indexOf(req.path) != -1) {
        return res.redirect('/access-denied');
      }

      // Setup user variable for api endpoints to access
      req.user = program.users[decoded.username];
      req.user.username = decoded.username;

      next();
    });
  });
}
