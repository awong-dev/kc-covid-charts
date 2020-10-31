const fs = require('fs');
const fetch = require('node-fetch');
const https = require('https');
const cheerio = require('cheerio');
const ExcelJS = require('exceljs');

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const ROOT_URL='https://www.kingcounty.gov/depts/health/covid-19/data/'

// Takes an excep file and turns the data into a plain data object.
async function parseExcel(excelBlob) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(excelBlob);
  const data = {};
  workbook.eachSheet((worksheet, sheetId) => {
    const sheetData =  [];
    worksheet.eachRow((row, rowNumber) => {
      const cleanvalues = row.values.map(v => {
        if (isNaN(v)) {
          return v.trim()
        } else {
          return Number(v);
        }
      });


      // Excel is 1 indexed, so the cleanvalues element 0 is empty.

      if (rowNumber === 1) {
        cleanvalues[0] = 'row';
      } else {
        cleanvalues[0] = rowNumber;
      }

      sheetData.push(cleanvalues);
    });    
    data[worksheet.name] = sheetData;
  });
  return data;
}

// Downloads an excel file and returns it as a plain data object.
// Also uploads the file into cloud storage and the data into the realtime db.
async function getExcelFile(path) {
  const result = await fetch(`${ROOT_URL}/${path}`, {agent: httpsAgent});
  const data = parseExcel(result.text());
  return data;
}

// Parses the King County Daily summary site and downloads the latest data file.
function downloadLatestData() {
  fetch(`${ROOT_URL}/daily-summary.aspx`, {agent: httpsAgent})
    .then(res => res.text())
    .then(async body => {
      const $ = cheerio.load(body);
      const anchor = $('ul li strong a', '#EXTRAScollapse1');
      const datafile = anchor.attr('href');
      const data = await getDataFile(datafile);
    })
    .catch(err => console.error(err));
}

async function test() {
const data = fs.readFileSync('2020-jul-13.xls');
fs.writeFileSync('out.json', JSON.stringify(await parseExcel(data)));
}

test();
