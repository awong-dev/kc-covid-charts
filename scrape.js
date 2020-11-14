require('chromedriver');
const webdriver = require('selenium-webdriver');
const By = webdriver.By;

const LONG_ACTION_MS = 7000;

const VP_WIDTH = 1280;
const VP_HEIGHT = 850;

const sleep = ms => new Promise( res => setTimeout(res, ms));

const data = {};

async function createDriver() {
  const driver = new webdriver.Builder()
    .forBrowser('chrome')
    .build();
  driver.manage().window().setRect({width: VP_WIDTH, height: VP_HEIGHT, x:0, y:0});
  const session = await driver.getSession();
  console.log(session.getId());
  return driver;
}

async function setupPage() {
  console.log(JSON.stringify(data, null, 2));
  const driver = await createDriver();
  await driver.wait(driver.get("https://www.kingcounty.gov/depts/health/covid-19/data/daily-summary.aspx"));
  await sleep(LONG_ACTION_MS);
  await driver.wait(driver.executeScript('document.querySelector(\'iframe[title="Data Visualization"]\').scrollIntoView()'));

  await driver.wait(driver.switchTo().frame(1)); // We know the data visualization frame is frame #1.

  // Click geography. This causes lots of calulations.
  await driver.wait(driver.findElement(By.xpath('//span[@value="Geography"]')).then( el => el.click()));
  await sleep(LONG_ACTION_MS);

  // Click the measurement type.
  await driver.wait(driver.findElement(By.xpath('//a[contains(concat(" ", normalize-space(@class), " "), " FIText ") and @title="Test Positivity"]')).then(
    el => el.findElement(By.xpath('./../input')).then( input => input.click())));
  await sleep(LONG_ACTION_MS);

  // Move the map in to view.
  await driver.wait(driver.executeScript('document.querySelectorAll(\'canvas.tabCanvas\')[0].scrollIntoView()'));
  return driver;
}

async function scrape() {
  const driver = await setupPage();
  // Now walk through the map.
  //for (let x = 300; onePixelIsInBounds && x < VP_WIDTH; x += 10) {
  let onePixelIsInBounds = true;
  for (let x = 350; onePixelIsInBounds && x < 400; x += 20) {
    onePixelIsInBounds = false;
    for (let y = 0; y < VP_HEIGHT; y += 10) {
      try {
        await driver.wait(driver.actions().move({x, y}).perform());
        onePixelIsInBounds = true;

        try {
          // document.getElementsByClassName('tab-ubertipTooltip')[0].firstElementChild.children[0].textContent
          // 1 = location name
          // 3 = measurement "Measure: xxxx"
          // 5 = Results "xxxx test results: nnn"
          const tooltip = await driver.findElement(By.xpath('//div[contains(concat(" ", normalize-space(@class), " "), " tab-ubertipTooltip ")]'));
          const locationName = await (await tooltip.findElement(By.xpath('./span/div[position() = 1]'))).getText();
          const measurement = await (await tooltip.findElement(By.xpath('./span/div[position() = 3]'))).getText();
          const positives = await (await tooltip.findElement(By.xpath('./span/div[position() = 5]'))).getText();
          const totalTests = await (await tooltip.findElement(By.xpath('./span/div[position() = 6]'))).getText();
          data[locationName] = {measurement, result, positives, totalTests};
        } catch (err) {
          // Ignore. A lot of the times the tooltip is not here.
        }

      } catch (err) {
        console.log(`Failed on (${x},${y}): ${err}`);
        break;
      }
    }
  }

  console.log(JSON.stringify(data, null, 2));
}

module.exports = { setupPage, scrape };

if(require.main == module)
    scrape();
