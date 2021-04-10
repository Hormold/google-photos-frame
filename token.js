require('dotenv').config();
const { google } = require('googleapis');
const oauth2Client = new google.auth.OAuth2(process.env['APP_ID'], process.env['APP_SECRET'], 'http://localhost:3000/test');
const url = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/photoslibrary.readonly'],
});
console.log(`URL: ${url}`);

const CODE = process.env['REFRESH_TOKEN'];
(async () => {
  const { tokens } = await oauth2Client.getToken(CODE);
  console.log(tokens);
})();
