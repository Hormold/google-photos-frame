require('dotenv').config();

const { google } = require('googleapis');
const Photos = require('./googlephotos');
const moment = require('moment');
const stream = require('stream');
const { promisify } = require('util');
const fs = require('fs');
const got = require('got');
const pipeline = promisify(stream.pipeline);
const { exec } = require('child_process');
const oauth2Client = new google.auth.OAuth2(process.env['APP_ID'], process.env['APP_SECRET'], 'http://localhost:3000/test');
oauth2Client.setCredentials({
  refresh_token: process.env['REFRESH_TOKEN'],
});

const MAX_RANGE = +process.env['MAX_RANGE'] || 300;
const rand = (min, max) => -Math.floor(min - Math.random() * (max - min + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
// eslint-disable-next-line promise/param-names
const sleep = async ms => new Promise(r => setTimeout(r, ms));

let CURRENT_INDEX = 0;
let PHOTOS_INDEX = [];
// const TO_LOAD = 50;

const init = async () => {
  PHOTOS_INDEX = [];
  CURRENT_INDEX = 0;

  oauth2Client.refreshAccessToken(async (error, tokens) => {
    console.log('Using token: ' + tokens.access_token);
    const photos = new Photos(tokens.access_token);
    (async () => {
      while (1) {
        try {
          const result = await search(photos);
          let res1 = pick(result);
          while (PHOTOS_INDEX.includes(res1))
            res1 = pick(result);
          
          let res2 = pick(result);
          while (PHOTOS_INDEX.includes(res2))
            res2 = pick(result);
          
          PHOTOS_INDEX.push(res1, res2);
          console.log(`Loaded ${PHOTOS_INDEX.length} photos!`);
          runScript();
          await sleep(60000);
        } catch (err) {
          PHOTOS_INDEX = [];
          CURRENT_INDEX = 0;
          console.log(`Error, sleep`, err);
          await sleep(60000);
        }
        if (PHOTOS_INDEX.length > 60 * 10) {
          PHOTOS_INDEX = [];
          CURRENT_INDEX = 0;
        }
      }
    })();
  });
};

const runScript = async () => {
  try {
    console.log('Start downloading #' + CURRENT_INDEX);
    if (!PHOTOS_INDEX[CURRENT_INDEX]) {
      CURRENT_INDEX = 0;
      PHOTOS_INDEX = [];
      return;
    }
    await pipeline(
      got.stream(PHOTOS_INDEX[CURRENT_INDEX]),
      fs.createWriteStream('tmp.jpeg')
    );
    console.log('Downloaded photo #' + CURRENT_INDEX);
    
    const command = `python3 run.py`;

    exec(command, async (err, stdout, stderr) => {
      CURRENT_INDEX++;
      if (err || stderr)
        return console.log('PyErr', err || stderr);
    });
  } catch (err) {
    CURRENT_INDEX++;
    console.log('runScript error', err);
  }
};

const search = async photos => {
  const filters = new photos.Filters(true);
  const FROM = rand(0, MAX_RANGE);
  const TO = FROM - 2;
  const dateFilter = new photos.DateFilter();
  dateFilter.addRange(new Date(moment().subtract(FROM, 'days')), new Date(moment().subtract(TO, 'days')));
  filters.setDateFilter(dateFilter);

  const mediaTypeFilter = new photos.MediaTypeFilter(photos.MediaType.PHOTO);
  filters.setMediaTypeFilter(mediaTypeFilter);

  const { body } = await photos.mediaItems.search(filters);
  if (!body.mediaItems || !body.mediaItems.length) {
    console.log('Error with loading mediaItems!');
    return search(photos);
  }
  const photosList = body.mediaItems.filter(
    f =>
      f.mediaMetadata &&
            f.mediaMetadata.photo.cameraMake &&
            +f.mediaMetadata.width > +f.mediaMetadata.height
  );
  const randomPhotos = photosList.map(f => f.baseUrl + '=w880-h528');
  return randomPhotos;
};

try {
  init();
} catch (err) {
  console.log('err', err);
}
