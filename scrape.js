const puppeteer = require('puppeteer');
const _ = require('lodash');

// This is a list of location to coordinates mapping.
const MapSamplePoints = require('./data/map-sample-points.json');

const M_TEST_POS = 'Test Positivity';
const M_DEATHS = 'Deaths';
const M_HOSP = 'Hospitalizations';
const M_PEOPLE_TESTED = 'People tested';

const L_CITY = 'city';
const L_HRA = 'hra';
const L_ZIP = 'zip';
const L_CENSUS = 'census';

const LONG_ACTION_MS = 4000;

const VP_WIDTH = 1280;
const VP_HEIGHT = 850;

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function launchBrowser() {
  return await puppeteer.launch({
    headless: true,
    userDataDir: '/tmp/puppeteer-userdata',
    args: ['--disable-features=site-per-process'],
  });
}

async function setupPage(browser) {
  const page = (await browser.pages())[0];
  // Make everything consistent and ignore youtube.
  await page.setViewport({width: VP_WIDTH, height: VP_HEIGHT});
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
  await page.evaluate(() => document.querySelector('iframe[title="Data Visualization"]').scrollIntoView());
  await sleep(LONG_ACTION_MS);  // Wait for loads to finish.

  return page;
}

async function setupTableauFrame(page) {
  const iframeHandle = await page.$('iframe[title="Data Visualization"]');
  const tableauFrame = await iframeHandle.contentFrame();

  // Click geography. This causes lots of calulations.
  (await tableauFrame.$('span[value="Geography"]')).click();
  await sleep(LONG_ACTION_MS);

  return tableauFrame;
}

async function selectLocationType(page, tableauFrame, locationType) {
  await tableauFrame.evaluate(() => document.querySelector('div[tb-test-id="Map chooser"]').scrollIntoView());
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
  const measurementText = await tableauFrame.$(`a.FIText[title="${measurement}"]`);
  const measurementButton = (await measurementText.$x('./../input'))[0];

  // Do it twice. For great glory and robustness.
  await measurementButton.click();
  await measurementButton.click();

  await sleep(LONG_ACTION_MS);

  // Move the map in to view.
  await tableauFrame.evaluate(() => document.querySelector('canvas.tabCanvas').scrollIntoView());
}

function toNumber(s) {
  return Number(s.replace(/,/, ''));
}

async function extractLocationName(tooltip) {
  return await tooltip.$eval('span > div:nth-child(1)', el => el.textContent);
}

async function extractTestPositivity(tooltip) {
  // For Test Positivity...
  // 1 = location name
  // 5 = positives "xxxx test results: nnn"
  // 6 = total tests "xxxx test results: nnn"
  const locationName = await extractLocationName(tooltip);
  const positives = toNumber((await tooltip.$eval('span > div:nth-child(5)', el => el.textContent)).match(/Positive test results: (.*)/)[1]);
  const totalTests = toNumber((await tooltip.$eval('span > div:nth-child(6)', el => el.textContent)).match(/All test results: (.*)/)[1]);
  return [locationName, { positives, totalTests }];
}

async function extractDeaths(tooltip) {
  // For Test Positivity...
  // 1 = location name
  // 5 = deaths "Deaths: nnn"
  const locationName = await extractLocationName(tooltip);
  const deaths = toNumber((await tooltip.$eval('span > div:nth-child(5)', el => el.textContent)).match(/Deaths: (.*)/)[1]);
  return [locationName, { deaths }];
}

async function extractHospitalizations(tooltip) {
  // For Test Positivity...
  // 1 = location name
  // 5 = "Hospitalizations: nnn"
  const locationName = await extractLocationName(tooltip);
  const hospitalizations = toNumber((await tooltip.$eval('span > div:nth-child(5)', el => el.textContent)).match(/Hospitalizations: (.*)/)[1]);
  return [locationName, { hospitalizations }];
}

async function extractPeopleTested(tooltip) {
  // For Test Positivity...
  // 1 = location name
  // 5 = "People tested: nnn"
  const locationName = await extractLocationName(tooltip);
  const peopleTested = toNumber((await tooltip.$eval('span > div:nth-child(5)', el => el.textContent)).match(/People tested: (.*)/)[1]);
  return [locationName, { peopleTested }];
}

let pixelCount = 0;
// Bounds and resolution discovered empirically to scrape all 48 HRAs. This is incorrect for
// city, zips, and census.
const DEFAULT_SCRAPE_OPTIONS = {
  startx: 340, starty: 0, endx: 900, endy: 500, xinc: 2, yinc: 2,
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
async function scrapeLocation(page, frame, x, y, extractFunc) {
  await page.mouse.move(x, y);

  let tooltip = null;
  try {
    tooltip = await frame.$('div.tab-ubertipTooltip');
  } catch (err) {
    // Ignore if we can't find the tooltip.
  }

  if (tooltip) {
    return extractFunc(tooltip);
  }

  return null;
}

// Given a locationName like "Zip code: 98070" and an array of coordiantes,
// attempts to get the data for locationName by moving to those coordinates.
// Makes maxRetry attempts.
//
// Returns the scraped measurement data.
async function scrapePoints(page, frame, locationName, points, extractFunc, maxRetry = 10) {
  for (let i = 0; i < maxRetry; i++) {
    const [x, y] = points[i];
    const result = await scrapeLocation(page, frame, x, y, extractFunc);
    if (result && result[0] === locationName) {
      return result[1];
    }
    console.error(`Mismatch ${locationName} and ${result}: ${i}@${points[i]}`);
  }
  return null;
}

// This generates a list of coordinates for each location. Used to create a
// map-sampling-points.json to speed up actual scraping.
async function scrapeMapPoints(page, tableauFrame, options = DEFAULT_SCRAPE_OPTIONS) {
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
        locationName = await extractLocationName(tooltip);
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
async function scrape() {
  const browser = await launchBrowser();
  const page = await setupPage(browser);
  const tableauFrame = await setupTableauFrame(page);

  // Now walk through the map. Bounds and resolution discovered empirically
  // to scrape all 48 HRAs.
  const measurementConfig = [
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

  const data = {};

  for (const locationType of [L_ZIP, L_HRA, L_CITY, L_CENSUS]) {
    await selectLocationType(page, tableauFrame, locationType);
    const typeData = data[locationType] = data[locationType] || {};
    for (const config of measurementConfig) {
      await selectMeasurement(tableauFrame, config.measurement);
      for (const [locationName, locationInfo] of Object.entries(MapSamplePoints[locationType])) {
        const locationData = typeData[locationName] = typeData[locationName] || {};
        _.merge(locationData, await scrapePoints(page, tableauFrame, locationName, locationInfo.points, config.extractFunc));
      }
    }
  }

  await browser.close();
  console.log(JSON.stringify(data, null, 2));
  return data;
}

async function scrapeAllMapPoints() {
  const browser = await launchBrowser();
  const page = await setupPage(browser);
  const tableauFrame = await setupTableauFrame(page);

  const data = {};

  for (const locationType of [L_ZIP, L_HRA, L_CITY, L_CENSUS]) {
    await selectLocationType(page, tableauFrame, locationType);
//    await selectMeasurement(tableauFrame, M_TEST_POS);
    data[locationType] = await scrapeMapPoints(page, tableauFrame);
  }

  await browser.close();
  console.log(JSON.stringify(data, null, 2));
  return data;
}

if (require.main === module) {
//  scrape();
  scrapeAllMapPoints();
}

module.exports = {
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
};
