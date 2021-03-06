const fs = require('fs');

exports.setup = function (loadJson) {
  var errorArray = [];

  // Check for port
  if (!loadJson.port) {
    loadJson.port = 3000;
  }

  // Check for UI
  if (!loadJson.userinterface) {
    loadJson.userinterface = 'public';
  }

  if (!loadJson.database_plugin) {
    loadJson.database_plugin = {};
  }

  if (!loadJson.database_plugin.dbPath) {
    loadJson.database_plugin.dbPath = 'mstream.db';
  }

  if (loadJson.database_plugin.interval === false) {
    loadJson.database_plugin.interval = 0;
  }

  loadJson.database_plugin.interval = Number(loadJson.database_plugin.interval);
  if (typeof loadJson.database_plugin.interval !== 'number' || isNaN(loadJson.database_plugin.interval) || loadJson.database_plugin.interval < 0) {
    loadJson.database_plugin.interval = 24;
  }

  loadJson.database_plugin.saveInterval = Number(loadJson.database_plugin.saveInterval);
  if (typeof loadJson.database_plugin.saveInterval !== 'number' || isNaN(loadJson.database_plugin.saveInterval) || loadJson.database_plugin.saveInterval < 0) {
    loadJson.database_plugin.saveInterval = 250;
  }

  loadJson.database_plugin.pause = Number(loadJson.database_plugin.pause);
  if (typeof loadJson.database_plugin.pause !== 'number' || isNaN(loadJson.database_plugin.pause) || loadJson.database_plugin.pause < 0) {
    loadJson.database_plugin.pause = 0;
  }

  if (!loadJson.folders || typeof loadJson.folders !== 'object') {
    loadJson.folders = {
      'media': { root: process.cwd() }
    }
  }

  for (let folder in loadJson.folders) {
    if (typeof loadJson.folders[folder] === 'string') {
      let folderString = loadJson.folders[folder];
      loadJson.folders[folder] = {
        root: folderString
      };
    }

    // Verify path is real
    if (!loadJson.folders[folder].root || !fs.statSync(loadJson.folders[folder].root).isDirectory()) {
      errorArray.push(loadJson.folders[folder].root + ' is not a real path');
    }
  }

  if (loadJson.users && typeof loadJson.users !== 'object') {
    errorArray.push('Users need to be an object');
    loadJson.error = errorArray;
    return loadJson;
  }

  for (let user in loadJson.users) {
    if (typeof loadJson.users[user].vpaths === 'string') {
      loadJson.users[user].vpaths = [loadJson.users[user].vpaths];
    }
  }

  // TODO: Assure all users have password, or hashes + salts

  if (errorArray.length > 0) {
    loadJson.error = errorArray;
  }

  // Export JSON
  return loadJson;
}
