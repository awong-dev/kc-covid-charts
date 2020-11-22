const puppeteer = require('puppeteer');
const _ = require('lodash');

// This is a list of location to coordinates mapping.
const MapSamplePoints = require('./map-sample-points.json');

const M_TEST_POS = 'Test Positivity';
const M_DEATHS = 'Deaths';
const M_HOSP = 'Hospitalizations';
const M_PEOPLE_TESTED = 'People tested';

const L_CITY = 'city';
const L_HRA = 'hra';
const L_ZIP = 'zip';
const L_CENSUS = 'census';
const LOCATION_TYPES = [ L_CENSUS, L_CITY, L_HRA, L_ZIP ];
const NAME_FUNC ={
 [L_CITY]: x => x,
 [L_HRA]: x => x,
 [L_CENSUS]: x => x.slice(20)/100,
 [L_ZIP]: x => x.slice(10),
};

const LONG_ACTION_MS = 10000;

const VP_WIDTH = 1280;
const VP_HEIGHT = 850;
const is_gcp_environment = process.env.GCP_PROJECT !== undefined;

const MEASUREMENT_CONFIG = [
  {
    measurement: M_TEST_POS,
    extractFunc: extractTestPositivity,
  }, {
    measurement: M_DEATHS,
    extractFunc: extractDeaths,
  }, {
    measurement: M_HOSP,
    extractFunc: extractHospitalizations,
  }, {
    measurement: M_PEOPLE_TESTED,
    extractFunc: extractPeopleTested,
  },
];

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Used in place of sleep to try actions like scrollIntoView and retrieving text content
async function retry(func, expectTruthy=true, timeoutMs=LONG_ACTION_MS) {
  const waitMs = 10;
  let retryCount = ~~(timeoutMs/waitMs);
  while(retryCount--) {
    try {
      const result = await func();
      if (!expectTruthy || (result && result !== 'null')) {
        return result;
      }
    } catch (err) {
      if (retryCount <= 0) {
        throw err;
      }
    } 
    await sleep(waitMs);
  }

  if (expectTruthy) {
    throw "Failed after many retries";
  }
}

async function launchBrowser() {
  return await puppeteer.launch({
//   headless: false,
    userDataDir: '/tmp/puppeteer-userdata',
    args: ['--disable-features=site-per-process', '--font-render-hinting=none', '--no-sandbox'],
  });
}

async function setupPage(browser) {
  const page = (await browser.pages())[0];
  // Make everything consistent and ignore youtube.
  await page.setViewport({width: VP_WIDTH, height: VP_HEIGHT, deviceScaleFactor: 2});
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.url().includes('youtube')) {
      request.abort();
    } else {
      request.continue();
    }
  });

  // Get the content scrolled in.
  await page.goto('https://www.kingcounty.gov/depts/health/covid-19/data/daily-summary.aspx');
  await retry(() => page.evaluate(() => document.querySelector('iframe[title="Data Visualization"]').scrollIntoView()), false);

  return page;
}

async function setupTableauFrame(page) {
  const iframeHandle = await retry(() => page.$('iframe[title="Data Visualization"]'));
  const tableauFrame = await iframeHandle.contentFrame();

  // Got to wait until the covering spinner goes away otherwise the click is eaten.
  await sleep(LONG_ACTION_MS);

  // Click geography. This causes lots of calulations.
  await (await retry(()=>tableauFrame.$('span[value="Geography"]'))).click();
  await sleep(LONG_ACTION_MS);

  return tableauFrame;
}

async function selectLocationType(page, tableauFrame, locationType) {
  await retry(() => tableauFrame.evaluate(() => document.querySelector('div[tb-test-id="Map chooser"]').scrollIntoView()), false);

  if (locationType === L_CITY) {
    await page.mouse.click(200, 50);
  } else if (locationType === L_HRA) {
    await page.mouse.click(400, 50);
  } else if (locationType === L_ZIP) {
    await page.mouse.click(600, 50);
  } else if (locationType === L_CENSUS) {
    await page.mouse.click(850, 50);
  }
  await sleep(LONG_ACTION_MS);
}

async function selectMeasurement(tableauFrame, measurement) {
  // Click the measurement type.
  await retry(() => tableauFrame.evaluate((m) => document.querySelector(`a.FIText[title="${m}"]`).parentElement.querySelector('input').click(), measurement), false);

  await sleep(LONG_ACTION_MS);
}

async function scrollToMap(tableauFrame) {
  // Move the map in to view.
  await retry(() => tableauFrame.evaluate(() => document.querySelector('canvas.tabCanvas').scrollIntoView()), false);
}

function toNumber(s) {
  return Number(s.replace(/,/, ''));
}

async function getMeasurement(tooltip, index) {
  return await retry(() => tooltip.$eval(`span div:nth-child(${index})`, el => el.textContent), true, 10);
}

async function extractLocationName(tooltip, extractNameFunc) {
  return extractNameFunc(await getMeasurement(tooltip, 1));
}

async function extractTestPositivity(tooltip) {
  // For Test Positivity...
  // 1 = location name
  // 5 = positives "xxxx test results: nnn"
  // 6 = total tests "xxxx test results: nnn"
  const positives = toNumber((await getMeasurement(tooltip, 5)).match(/Positive test results: (.*)/)[1]);
  const totalTests = toNumber((await getMeasurement(tooltip, 6)).match(/All test results: (.*)/)[1]);
  return { positives, totalTests };
}

async function extractDeaths(tooltip) {
  // For Test Positivity...
  // 1 = location name
  // 5 = deaths "Deaths: nnn"
  const deaths = toNumber((await getMeasurement(tooltip, 5)).match(/Deaths: (.*)/)[1]);
  return { deaths };
}

async function extractHospitalizations(tooltip) {
  // For Test Positivity...
  // 1 = location name
  // 5 = "Hospitalizations: nnn"
  const hospitalizations = toNumber((await getMeasurement(tooltip, 5)).match(/Hospitalizations: (.*)/)[1]);
  return { hospitalizations };
}

async function extractPeopleTested(tooltip) {
  // For Test Positivity...
  // 5 = "People tested: nnn"
  const peopleTested = toNumber((await getMeasurement(tooltip, 5)).match(/People tested: (.*)/)[1]);
  return { peopleTested };
}

let pixelCount = 0;
// Bounds and resolution discovered empirically to scrape all 48 HRAs. This is incorrect for
// city, zips, and census.
const DEFAULT_SCRAPE_OPTIONS = {
  startx: 340, starty: 0, endx: 950, endy: 480, xinc: 2, yinc: 2,
//  startx: 400, starty: 50, endx: 500, endy: 100, xinc: 10, yinc: 10,
};

// Original scraping code that attempts to sample the whole map rectangle for data.
async function scrapeRegion(page, tableauFrame, extractFunc, options = DEFAULT_SCRAPE_OPTIONS) {
  const data = {};
  let onePixelIsInBounds = true;
  console.log('Starting region scrape');
  for (let x = options.startx; onePixelIsInBounds && x < options.endx; x += options.xinc) {
    if ((pixelCount++ % 1000) === 0) {
      console.error(`Made it to (${x},${y}):`);
    }
    onePixelIsInBounds = false;
    for (let y = options.starty; y < options.endy; y += options.yinc) {
      try {
        await page.mouse.move(x, y);
        onePixelIsInBounds = true;
        await sleep(10); // give a bit for hover to raect.

        let tooltip = null;
        try {
          tooltip = await tableauFrame.$('div.tab-ubertipTooltip');
        } catch (err) {
          // Ignore if we can't find the tooltip.
        }

        if (tooltip) {
          const [locationName, values] = await extractFunc(tooltip);
          data[locationName] = data[locationName] || {};
          Object.assign(data[locationName], values);
        }
      } catch (err) {
        console.log(`Failed on (${x},${y}): ${err}`);
        break;
      }
    }
  }

  return data;
}

// Runs the extract function on the given (x,y) coordinate.
//
// Throws if the tooltip format is not what is expected. This allows for
// noticing formating changes that break the scraper.
async function scrapeLocation(page, frame, x, y, extractFunc, extractNameFunc) {
  await page.mouse.move(x, y);

  let tooltip = null;
  let locationName = null;
  try {
    // Wait for the locationName.
    tooltip = await frame.$('div.tab-ubertipTooltip');
    locationName = await extractLocationName(tooltip, extractNameFunc);
  } catch (err) {
    // Ignore if we can't find the tooltip.
  }

  if (tooltip && locationName) {
    return [locationName, await extractFunc(tooltip)];
  }

  return [null, null];
}

// Given a locationName like "Zip code: 98070" and an array of coordiantes,
// attempts to get the data for locationName by moving to those coordinates.
// Makes maxRetry attempts.
//
// Returns the scraped measurement data.
async function scrapePoints(page, frame, locationName, points, extractFunc, extractNameFunc, maxRetry = 10) {
  try {
    for (let i = 0; i < maxRetry; i++) {
      const [x, y] = points[i];
      const result = await scrapeLocation(page, frame, x, y, extractFunc);
      if (result[0] === locationName) {
        return result[1];
      }
      console.error(`Mismatch ${locationName} and ${result[0]} value ${JSON.stringify(result[1])}: ${i}@${points[i]}`);
      if (!is_gcp_environment) {
        await page.screenshot({path: 'mismatch.png'});
      }
    }
  } catch (err) {
    console.error(`Faoilled: ${locationName}: ${err}`);
    return null;
  }
  return null;
}

// This generates a list of coordinates for each location. Used to create a
// map-sampling-points.json to speed up actual scraping.
async function scrapeMapPoints(page, tableauFrame, extractNameFunc, options = DEFAULT_SCRAPE_OPTIONS) {
  const data = {};
  let onePixelIsInBounds = true;
  console.error(`Starting Map Points scrape ${JSON.stringify(options)}`);
  for (let x = options.startx; onePixelIsInBounds && x < options.endx; x += options.xinc) {
    onePixelIsInBounds = false;
    for (let y = options.starty; y < options.endy; y += options.yinc) {
      if ((pixelCount++ % 1000) === 0) {
        console.error(`Made it to (${x},${y}):`);
      }
      await page.mouse.move(x, y);
      onePixelIsInBounds = true;

      let tooltip = null;
      let locationName = null;
      try {
        tooltip = await tableauFrame.$('div.tab-ubertipTooltip');
        locationName = await extractLocationName(tooltip, extractNameFunc);
      } catch (err) {
        // Ignore if we can't find the tooltip.
      }
      if (tooltip && locationName) {
        data[locationName] = data[locationName] || { points: [] };
        data[locationName].points.push([x, y]);
      }
    }
  }

  return data;
}

// Given two sets of points from different scrapeMapPoints runs, merges the data and returns
// the points in a scrambled order. The scrambling is to allow retries to hit different parts
// of the location polygon which should hopefully make it more robust to rendering differences.
function mergeMapPoints(points1, points2) {
  const unionArray = (objValue, srcValue) => {
    if (_.isArray(objValue) && _.isArray(srcValue)) {
      return _.unionWith(objValue, srcValue, _.isEqual);
    }
  };

  const merged = _.mergeWith({}, points1, points2, unionArray);

  // Return values shuffled. Makes sampling later a bit succeptible to systemic failure.
  return _.mapValues(
    merged,
    (location) => _.mapValues(location,
      (points) => _.mapValues(points, (ar) => _.shuffle(ar))),
  );
}

// Main entry point to scraping.
async function scrape(locationType) {
  const browser = await launchBrowser();
  const data = {};

  try {
    const page = await setupPage(browser);
    const tableauFrame = await setupTableauFrame(page);

    await selectLocationType(page, tableauFrame, locationType);
    await scrollToMap(tableauFrame);
    const typeData = data[locationType] = data[locationType] || {};
    for (const config of MEASUREMENT_CONFIG) {
      console.log(`scraping ${config.measurement}`);
      await selectMeasurement(tableauFrame, config.measurement);
      if (locationType in MapSamplePoints) {
        for (const [locationName, locationInfo] of Object.entries(MapSamplePoints[locationType])) {
          const locationData = typeData[locationName] = typeData[locationName] || {};
          if (!locationInfo.points) {
            console.error(`${locationType}, ${locationName}: ${JSON.stringify(locationInfo)}`);
            continue;
          }
          const result = await scrapePoints(page, tableauFrame, locationName, locationInfo.points, config.extractFunc, NAME_FUNC[locationType]);
          if (result) {
            _.merge(locationData, result);
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  return data;
}

async function scrapeAllMapPoints() {
  const browser = await launchBrowser();
  const page = await setupPage(browser);
  const tableauFrame = await setupTableauFrame(page);

  const data = {};

  try {
    await selectMeasurement(tableauFrame, M_TEST_POS);
    for (const locationType of LOCATION_TYPES) {
      await selectLocationType(page, tableauFrame, locationType);
      await scrollToMap(tableauFrame);
      data[locationType] = await scrapeMapPoints(page, tableauFrame, NAME_FUNC[locationType]);
    }
  } catch (err) {
    if (!is_gcp_environment) {
      await page.screenshot({path: 'crashed.png'});
    }
    console.error("Crashed " + err);
  }

  await browser.close();
  console.log(JSON.stringify(data, null, 2));
  return data;
}

async function test() {
  const browser = await launchBrowser();
  const page = await setupPage(browser);
  const tableauFrame = await setupTableauFrame(page);
  /*
  await selectLocationType(page, tableauFrame, L_ZIP);
  await selectMeasurement(tableauFrame, M_TEST_POS);
  await scrollToMap(tableauFrame);
 */
  return [ browser, page, tableauFrame ];
}

if (require.main === module) {
  if (process.argv[2] == "samplemap") {
    scrapeAllMapPoints();
  }

  scrape(process.argv[2]).then(data => console.log(JSON.stringify(data, null, 2)));
}

module.exports = {
  LOCATION_TYPES,
  launchBrowser,
  extractDeaths,
  extractHospitalizations,
  extractPeopleTested,
  extractTestPositivity,
  mergeMapPoints,
  scrape,
  scrapeMapPoints,
  scrapeRegion,
  selectLocationType,
  selectMeasurement,
  setupPage,
  setupTableauFrame,
  test,
};
