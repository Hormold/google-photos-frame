require('dotenv').config();
require('console-stamp')(console, '[HH:MM:ss.l]');
const PhotoFrame = require('./frame');

(async () => {
  const frame = new PhotoFrame();
  await frame.login();
  frame.flow();
})();
