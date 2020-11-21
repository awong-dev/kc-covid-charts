const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fs = require('fs');
const fetch = require('node-fetch');
const https = require('https');
const cheerio = require('cheerio');
const { parseExcel } = require('./excel');
const mergeData = require('./mergedata');
const scrape = require('./scrape');
const _ = require('lodash');

const logger = functions.logger;

admin.initializeApp({
  databaseURL: "https://kc-covid-chart.firebaseio.com",
  storageBucket: "kc-covid-chart.appspot.com"
});

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const ROOT_URL='https://www.kingcounty.gov/depts/health/covid-19/data'

// Downloads an excel file and returns it as a plain data object.
// Also uploads the file into cloud storage and the data into the realtime db.
async function scrapeDataFile(path, force) {
  const dataFileUrl = `${ROOT_URL}/${path}`;
  // Do HEAD of file.
  const headReponse = await fetch(dataFileUrl, {method: 'HEAD', agent: httpsAgent});

  if (!headReponse.ok) {
    throw `Failed Head for ${path}: ${headReponse.statusText}`;
  }

  const dataFileDate = new Date(headReponse.headers.get('Last-Modified'));
  const filenameBase = `kc-daily-covid-data-${dataFileDate.toISOString()}`;

  // Early out if already downloadd.
  const xlsFileName = filenameBase + '.xlsx';
  const excelFileRef = admin.storage().bucket().file(xlsFileName);
  if (!force) {
    const existResult = await excelFileRef.exists();
    if (existResult[0]) {
      logger.info(`Already downloaded ${xlsFileName}`);
      return { last_update: dataFileDate, data: null };
    }
  }

  // Download and process the actual file.
  const downloadResponse = await fetch(dataFileUrl, {agent: httpsAgen});
  const excelBlob = await downloadResponse.arrayBuffer();

  const excelUploadPromise = excelFileRef.save(Buffer.from(excelBlob), {
    gzip: true,
    metadata: {
      contentType: downloadResponse.headers.get('Content-Type')
    },
    predefinedAcl: "publicRead"
  });

  // Push to json.
  const data = await parseExcel(excelBlob);

  const jsonFileRef = admin.storage().bucket().file(filenameBase + '.json');
  const jsonUploadPromise = jsonFileRef.save(JSON.stringify(data), {
    gzip: true,
    metadata: {
      contentType: "application/json",
    },
    predefinedAcl: "publicRead"
  });

  await Promise.all([excelUploadPromise, jsonUploadPromise]);
  return { last_update: dataFileDate, data };
}

// Parses the King County Daily summary site and downloads the latest data file.
async function downloadLatestData(force) {
  const result = await fetch(`${ROOT_URL}/daily-summary.aspx`, {agent: httpsAgent})
  const body = await result.text();
  const $ = cheerio.load(body);
  const itemText = $('strong:contains("Overall counts and rates by city, health reporting area, and zip code")');
  logger.log(itemText.html());
  const anchor = itemText.parent();
  const datafile = anchor.attr('href');
  return await scrapeDataFile(datafile, force);
}

async function scrapeLatestData(type) {
  console.log(`scraping ${type}`);
  const last_update = new Date();
  const data = await scrape.scrape(type);
  return {last_update, data};
}

exports.snapshotData = functions.runWith({timeoutSeconds: 300, memory: '1GB'})
  .https.onRequest(async (request, response) => {
  try {
    const type = request.query.type;
    if (!scrape.LOCATION_TYPES.includes(type)) {
      console.error(`Invalid type ${type}`);
      return response.status(400).send(`invalid type: ${type}`);
    }
    const { last_update, data } = await scrapeLatestData(type);
    if (data !== null) {
      // Update the data.json.
      const dataFileRef = admin.storage().bucket().file(`processed/data-${type}.json`);
      const combinedDataPromise = new Promise((resolve, reject) => {
        const chunks = [];
        dataFileRef.createReadStream()
          .on('error', (err) => reject(err))
          .on('data', d => chunks.push(d))
          .on('end', () => resolve(JSON.parse(chunks.join(''))));
      });

      const combinedData = await combinedDataPromise;
      //mergeData(combinedData, data);
      _.merge(combinedData, data);
      await dataFileRef.save(JSON.stringify(combinedData), {
        gzip: true,
        metadata: {
          contentType: "application/json",
        },
        predefinedAcl: "publicRead"
      });

      response.send(`found new data: ${last_update}`);
    } else {
      response.send(`no updates since: ${last_update}`);
    }
  } catch (err) {
    logger.error(err);
    response.status(500).send(`failed: ${err}`);
  }
});
