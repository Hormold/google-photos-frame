const { google } = require('googleapis');
const Photos = require('./googlephotos');
const moment = require('moment');
const stream = require('stream');
const { promisify } = require('util');
const fs = require('fs');
const got = require('got');
const pipeline = promisify(stream.pipeline);
const { exec } = require('child_process');

const rand = (min, max) => -Math.floor(min - Math.random() * (max - min + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
// eslint-disable-next-line promise/param-names
const sleep = async ms => new Promise(r => setTimeout(r, ms));

class PhotoFrame {
  constructor () {
    this.MAX_RANGE = +process.env['MAX_RANGE'] || 300;
    this.CURRENT_INDEX = 0;
    this.PHOTOS_INDEX = [];
    this.needRelogin = true;
    this.token = null;
    this.lastFlow = Date.now();

    this.oauth2Client = new google.auth.OAuth2(process.env['APP_ID'], process.env['APP_SECRET'], 'http://localhost:3000/test');
    this.oauth2Client.setCredentials({
      refresh_token: process.env['REFRESH_TOKEN'],
    });
  }

  login () {
    return new Promise((resolve, reject) => {
      this.oauth2Client.refreshAccessToken(async (error, tokens) => {
        if (error) {
          console.log(`Error on refreshAccessToken`, error);
          return reject(error);
        }
        this.needRelogin = false;
        this.token = tokens.access_token;
        this.photos = new Photos(this.token);

        console.log('Using token: ' + tokens.access_token);
        resolve();
      });
    });
  }

  async flowController () {
    while (1) {
      const diff = Date.now() - this.lastFlow;
      if (diff > 90 * 1000)
        this.flow();
          
      await sleep(2000);
    }
  }

  async flow () {
    while (1) {
      this.lastFlow = Date.now();
      if (this.needRelogin) {
        console.log(`Need relogin!`);
        await this.login();
        await sleep(30000);
        continue;
      }
      if (!this.token) {
        await sleep(5000);
        continue;
      }
        
      console.log('Wakeup, looking for new photos');
      const result = await this.search(this.photos);
      if (!result.length) {
        console.log(`Not new photos loaded, skipping!`);
        await sleep(30000);
        continue;
      } else
        console.log(`Loaded ${result.length} photos!`);

      let res1 = pick(result);
      while (this.PHOTOS_INDEX.includes(res1))
        res1 = pick(result);
        
      let res2 = pick(result);
      while (this.PHOTOS_INDEX.includes(res2))
        res2 = pick(result);
          
      this.PHOTOS_INDEX.push(res1, res2);
      try {
        await this.runScript();
        console.log(`All done, go to sleep!`);
      } catch (err) {
        this.PHOTOS_INDEX = [];
        this.CURRENT_INDEX = 0;
        console.log(`Error, sleep`, err);
      }

      await sleep(60000);
      if (this.PHOTOS_INDEX.length > 120) {
        this.PHOTOS_INDEX = [];
        this.CURRENT_INDEX = 0;
        console.log(`Photos stack is overflown, cleanup`);
      }
    }
  }

  async runScript () {
    try {
      console.log('Start downloading #' + this.CURRENT_INDEX);
      if (!this.PHOTOS_INDEX[this.CURRENT_INDEX]) {
        this.CURRENT_INDEX = 0;
        this.PHOTOS_INDEX = [];
        return;
      }
      const url = this.PHOTOS_INDEX[this.CURRENT_INDEX];
      await pipeline(
        got.stream(url),
        fs.createWriteStream('tmp.jpeg')
      );
      console.log(`Downloaded photo #${this.CURRENT_INDEX}, start updating frame screen`);
      
      exec(`python3 run.py`, async (err, stdout, stderr) => {
        this.CURRENT_INDEX++;
        if (err || stderr)
          return console.log('PyErr', err || stderr);
        console.log(`Frame screen update finished!`);
      });
    } catch (err) {
      this.CURRENT_INDEX++;
      console.log('runScript error', err);
      if (err.toString().match(/403/) || err.toString().match(/401/)) this.needRelogin = true;
    }
  }

  async search (photos) {
    const filters = new photos.Filters(true);
    const FROM = rand(0, this.MAX_RANGE);
    const TO = FROM - 2;
    const dateFilter = new photos.DateFilter();
    dateFilter.addRange(new Date(moment().subtract(FROM, 'days')), new Date(moment().subtract(TO, 'days')));
    filters.setDateFilter(dateFilter);
  
    const mediaTypeFilter = new photos.MediaTypeFilter(photos.MediaType.PHOTO);
    filters.setMediaTypeFilter(mediaTypeFilter);
    try {
      const { body } = await photos.mediaItems.search(filters);
      if (!body.mediaItems || !body.mediaItems.length) {
        console.log('Error with loading mediaItems!');
        return this.search(photos);
      }
      const photosList = body.mediaItems.filter(
        f =>
          f.mediaMetadata &&
              f.mediaMetadata.photo.cameraMake &&
              +f.mediaMetadata.width > +f.mediaMetadata.height
      );
      const randomPhotos = photosList.map(f => f.baseUrl + '=w880-h528');
      return randomPhotos;
    } catch (err) {
      if (err.toString().match(/403/) || err.toString().match(/401/)) this.needRelogin = true;
      console.log('Photo search error', err);
      return [];
    }
  }
};

module.exports = PhotoFrame;
