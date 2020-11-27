// Bootstrap script to build the initial JSON file.

const admin = require('firebase-admin');
const fs = require('fs');
const glob = require('glob');
const { parseExcel } = require('./functions/excel');
const mergeData = require('./functions/mergedata');
const { idToHra, hraToId } = require('./functions/hras');

admin.initializeApp({
  databaseURL: 'https://kc-covid-chart.firebaseio.com',
  storageBucket: 'kc-covid-chart.appspot.com',
});

function globmise(pattern, options) {
  return new Promise((resolve, reject) => {
    glob(pattern, options, (err, files) => {
      if (err) {
        reject(err);
      } else {
        resolve(files);
      }
    });
  });
}

async function readFiles() {
  const biweeklyFile = process.argv[2];
  const jsonDir = process.argv[3];

  const combinedData = {};

  console.log(`Loading file ${biweeklyFile}`);
  const biweekly = await parseExcel(fs.readFileSync(biweeklyFile));
  mergeData(combinedData, biweekly);

  const jsonFiles = await globmise(`${jsonDir}/kc-daily-covid-data-*.json`);
  const dateExtract = /kc-daily-covid-data-(.*)\.json/;
  for (const f of jsonFiles) {
    console.log(`Processing ${f}`);
    const date = new Date(f.match(dateExtract)[1]);
    const data = JSON.parse(fs.readFileSync(f));
    mergeData(combinedData, data, date);
  }
  console.log(JSON.stringify(combinedData, null, 2));
  return combinedData;
}

async function processOutput(dataPromise) {
  const combinedData = await dataPromise;

  const fileRef = admin.storage().bucket().file('processed/data.json');

  await fileRef.save(JSON.stringify(combinedData), {
    gzip: true,
    metadata: {
      contentType: 'application/json',
    },
    predefinedAcl: 'publicRead',
  });
}

// processOutput(readFiles());

async function test() {
  const fileRef = admin.storage().bucket().file('processed/combined.json');
  const ref = admin.storage().bucket().file('processed/combined.json');
  const existResult = await ref.exists();
  console.log(existResult);
  if (existResult[0]) {
    console.log('exists');
  } else {
    console.log('not exists');
  }
}

test();
