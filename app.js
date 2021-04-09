require('dotenv').config();

const {google} = require('googleapis');
const Photos = require('./googlephotos');
const moment = require('moment');
const stream = require('stream');
const {promisify} = require('util');
const fs = require('fs');
const got = require('got');
const pipeline = promisify(stream.pipeline);
const { exec } = require('child_process');
const oauth2Client = new google.auth.OAuth2(process.env['APP_ID'], process.env['APP_SECRET'], "http://localhost:3000/test");
oauth2Client.setCredentials({
    refresh_token: process.env['REFRESH_TOKEN']
});

const MAX_RANGE = +process.env['MAX_RANGE'] || 300;
const rand = (min,max) => -Math.floor(min - Math.random() * (max-min+1))
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const sleep = async (ms) => await new Promise(r => setTimeout(r, ms));

let CURRENT_INDEX = 0;
let PHOTOS_INDEX = [];
let TO_LOAD = 50;
let FIRST_LOAD = false;
try {
    init();
    setInterval(() => {
        init();
    }, 60 * TO_LOAD * 2 * 1000);
} catch (err) {
    console.log('err', err)
}

async function init (){
    PHOTOS_INDEX = [];
    CURRENT_INDEX = 0;
    FIRST_LOAD = false;

    oauth2Client.refreshAccessToken( async (error, tokens) => {
        console.log('Using '+tokens.access_token)
        const photos = new Photos(tokens.access_token);
        (async () => {
            const url = search(photos);
            for(let i = 0; i<=TO_LOAD; i++) {
                const result = await search(photos);
                PHOTOS_INDEX.push(pick(result), pick(result));
                console.log(`Loaded ${PHOTOS_INDEX.length} photos!`)
                runScript();
                await sleep(60000);
            }
        })();
    });
}

async function runScript() {
    console.log('Start downloading #'+CURRENT_INDEX)

    await pipeline(
		got.stream(PHOTOS_INDEX[CURRENT_INDEX]),
		fs.createWriteStream('tmp.jpeg')
	);
    console.log('Downloaded photo #'+CURRENT_INDEX)


    
    const command = `python3 run.py`;

    exec(command, async (err, stdout, stderr) => {
        CURRENT_INDEX++;
        
        if (err) {
          return console.log('PyErr',err);
        }
      
        // the *entire* stdout and stderr (buffered)
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);
        //await sleep(60000);
       // await runScript();
    });

    
}


async function search(photos) {
    const filters = new photos.Filters(true);
    const FROM = rand(0, MAX_RANGE);
    const TO = FROM-2;
    const dateFilter = new photos.DateFilter();
    dateFilter.addRange(new Date(moment().subtract(FROM, 'days')), new Date(moment().subtract(TO, 'days')));
    filters.setDateFilter(dateFilter);

    const mediaTypeFilter = new photos.MediaTypeFilter(photos.MediaType.PHOTO);
    filters.setMediaTypeFilter(mediaTypeFilter);

    const {body} = await photos.mediaItems.search(filters);
    if(!body.mediaItems) {
        console.log('error1')
        return search(photos);
    }
    let photosList = body.mediaItems.filter(
        f => 
            f.mediaMetadata &&
            f.mediaMetadata.photo.cameraMake &&
            +f.mediaMetadata.width > f.mediaMetadata.height
        );
    let randomPhotos = photosList.map(f => f.baseUrl+"=w880-h528")
    return randomPhotos
}