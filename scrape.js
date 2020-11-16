require('chromedriver');
const _ = require('lodash');
const webdriver = require('selenium-webdriver');

const { By } = webdriver;

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

const LONG_ACTION_MS = 7000;

const VP_WIDTH = 1280;
const VP_HEIGHT = 850;

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function createDriver() {
  const driver = new webdriver.Builder()
    .forBrowser('chrome')
    .build();
  driver.manage().window().setRect({
    width: VP_WIDTH, height: VP_HEIGHT, x: 0, y: 0,
  });
  return driver;
}

async function setupPage() {
  const driver = await createDriver();
  await driver.get('https://www.kingcounty.gov/depts/health/covid-19/data/daily-summary.aspx');
  await sleep(LONG_ACTION_MS);
  await driver.executeScript('document.querySelector(\'iframe[title="Data Visualization"]\').scrollIntoView()');

  await driver.switchTo().frame(1); // We know the data visualization frame is frame #1.

  // Click geography. This causes lots of calulations.
  await driver.findElement(By.css('span[value="Geography"]')).then((el) => el.click());
  await sleep(LONG_ACTION_MS);

  return driver;
}

async function selectLocationType(driver, locationType) {
  await driver.executeScript('document.querySelectorAll(\'div[tb-test-id="Map chooser"\')[0].scrollIntoView()');
  if (locationType === L_CITY) {
    await driver.actions().move({ x: 200, y: 50 }).click().perform();
  } else if (locationType === L_HRA) {
    await driver.actions().move({ x: 400, y: 50 }).click().perform();
  } else if (locationType === L_ZIP) {
    await driver.actions().move({ x: 600, y: 50 }).click().perform();
  } else if (locationType === L_CENSUS) {
    await driver.actions().move({ x: 850, y: 50 }).click().perform();
  }
  await sleep(LONG_ACTION_MS);
}

async function selectMeasurement(driver, measurement) {
  // Click the measurement type.
  const measurementText = await driver.findElement(By.css(`a.FIText[title="${measurement}"]`));
  const measurementButton = await measurementText.findElement(By.xpath('./../input'));

  // Do it twice. For great glory and robustness.
  await measurementButton.click();
  await measurementButton.click();

  await sleep(LONG_ACTION_MS);

  // Move the map in to view.
  await driver.executeScript('document.querySelectorAll(\'canvas.tabCanvas\')[0].scrollIntoView()');
}

function toNumber(s) {
  return Number(s.replace(/,/, ''));
}

async function extractTestPositivity(tooltip) {
  // For Test Positivity...
  // 1 = location name
  // 5 = positives "xxxx test results: nnn"
  // 6 = total tests "xxxx test results: nnn"
  const locationName = await (await tooltip.findElement(By.css('span > div:nth-child(1)'))).getText();
  const positives = toNumber((await (await tooltip.findElement(By.css('span > div:nth-child(5)'))).getText()).match(/Positive test results: (.*)/)[1]);
  const totalTests = toNumber((await (await tooltip.findElement(By.css('span > div:nth-child(6)'))).getText()).match(/All test results: (.*)/)[1]);
  return [locationName, { positives, totalTests }];
}

async function extractDeaths(tooltip) {
  // For Test Positivity...
  // 1 = location name
  // 5 = deaths "Deaths: nnn"
  const locationName = await (await tooltip.findElement(By.css('span > div:nth-child(1)'))).getText();
  const deaths = toNumber((await (await tooltip.findElement(By.css('span > div:nth-child(5)'))).getText()).match(/Deaths: (.*)/)[1]);
  return [locationName, { deaths }];
}

async function extractHospitalizations(tooltip) {
  // For Test Positivity...
  // 1 = location name
  // 5 = "Hospitalizations: nnn"
  const locationName = await (await tooltip.findElement(By.css('span > div:nth-child(1)'))).getText();
  const hospitalizations = toNumber((await (await tooltip.findElement(By.css('span > div:nth-child(5)'))).getText()).match(/Hospitalizations: (.*)/)[1]);
  return [locationName, { hospitalizations }];
}

async function extractPeopleTested(tooltip) {
  // For Test Positivity...
  // 1 = location name
  // 5 = "People tested: nnn"
  const locationName = await (await tooltip.findElement(By.css('span > div:nth-child(1)'))).getText();
  const peopleTested = toNumber((await (await tooltip.findElement(By.css('span > div:nth-child(5)'))).getText()).match(/People tested: (.*)/)[1]);
  return [locationName, { peopleTested }];
}

let pixelCount = 0;
// Bounds and resolution discovered empirically to scrape all 48 HRAs. This is incorrect for
// city, zips, and census.
const DEFAULT_SCRAPE_OPTIONS = {
  startx: 350, starty: 30, endx: 570, endy: 350, xinc: 10, yinc: 10,
};

// Original scraping code that attempts to sample the whole map rectangle for data.
async function scrapeRegion(driver, extractFunc, options = DEFAULT_SCRAPE_OPTIONS) {
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
        await driver.actions().move({ x, y }).perform();
        onePixelIsInBounds = true;

        let tooltip = null;
        try {
          tooltip = await driver.findElement(By.css('div.tab-ubertipTooltip'));
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
async function scrapeLocation(driver, x, y, extractFunc) {
  await driver.actions().move({ x, y }).perform();

  let tooltip = null;
  try {
    tooltip = await driver.findElement(By.css('div.tab-ubertipTooltip'));
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
async function scrapePoints(driver, locationName, points, extractFunc, maxRetry = 10) {
  for (let i = 0; i < maxRetry; i++) {
    const [x, y] = points[i];
    const result = await scrapeLocation(driver, x, y, extractFunc);
    if (result && result[0] === locationName) {
      return result[1];
    }
    console.error(`Mismatch ${locationName} and ${result}: ${i}@${points[i]}`);
  }
  return null;
}

// This generates a list of coordinates for each location. Used to create a
// map-sampling-points.json to speed up actual scraping.
async function scrapeMapPoints(driver, options = DEFAULT_SCRAPE_OPTIONS) {
  const data = {};
  let onePixelIsInBounds = true;
  console.error(`Starting Map Points scrape ${JSON.stringify(options)}`);
  for (let x = options.startx; onePixelIsInBounds && x < options.endx; x += options.xinc) {
    onePixelIsInBounds = false;
    for (let y = options.starty; y < options.endy; y += options.yinc) {
      if ((pixelCount++ % 1000) === 0) {
        console.error(`Made it to (${x},${y}):`);
      }
      const movePromise = driver.actions().move({ x, y }).perform()
        .then(() => onePixelIsInBounds = true)
        .catch((err) => console.error(`Failed on (${x},${y}): ${err}`));

      let tooltip = null;
      let locationName = null;
      const tooltipPromise = driver.findElement(By.xpath('//div[contains(concat(" ", normalize-space(@class), " "), " tab-ubertipTooltip ")]'))
        .then((el) => { tooltip = el; return tooltip; })
        .then((tooltip) => tooltip.findElement(By.xpath('./span/div[position() = 1]')))
        .then((el) => el.getText())
        .then((text) => locationName = text)
        .catch((err) => {}); // Ignore if we can't find the tooltip or locationName.
      await Promise.all([tooltipPromise, movePromise]);

      if (tooltip) {
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
  const driver = await setupPage();

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
    await selectLocationType(driver, locationType);
    const typeData = data[locationType] = data[locationType] || {};
    for (const config of measurementConfig) {
      await selectMeasurement(driver, config.measurement);
      for (const [locationName, locationInfo] of Object.entries(MapSamplePoints[locationType])) {
        const locationData = typeData[locationName] = typeData[locationName] || {};
        _.merge(locationData, await scrapePoints(driver, locationName, locationInfo.points, config.extractFunc));
      }
    }
  }

  console.log(JSON.stringify(data, null, 2));
  return data;
}

if (require.main === module) scrape();

module.exports = {
  createDriver,
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
