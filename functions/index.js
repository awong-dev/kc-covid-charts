const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fs = require('fs');
const fetch = require('node-fetch');
const https = require('https');
const cheerio = require('cheerio');
const { parseExcel } = require('../excel');

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
  /*
  For some reason, this always return true.
  if (!force) {
    const existResult = await admin.storage().bucket().exists(xlsFileName);
    if (existsResult[0]) {
      logger.info(`Already downloaded ${xlsFileName}`);
      return { last_update: dataFileDate,  data: null };
    }
  }
 */

  // Download and process the actual file.
  const downloadResponse = await fetch(dataFileUrl, {agent: httpsAgent});
  const excelBlob = await downloadResponse.arrayBuffer();
  const excelFileRef = admin.storage().bucket().file(xlsFileName);

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

exports.snapshotData = functions.https.onRequest(async (request, response) => {
  try {
    const { last_update, data } = await downloadLatestData(request.query.force === '1');
    if (data !== null) {
      response.send(`found new data: ${last_update}`);
    } else {
      response.send(`no updates since: ${last_update}`);
    }
  } catch (err) {
    logger.error(err);
    response.status(500).send(`failed: ${err}`);
  }
});
