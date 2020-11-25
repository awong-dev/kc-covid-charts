function accumulateCount(counts, delta, accumulate) {
  if (accumulate && counts.length) {
    counts.push(counts[counts.length - 1] + delta);
  } else {
    counts.push(delta);
  }
}

// If dailyDate is set, indicates inputData is a daily file. This means
// 'Location_Name' is set correctly. Otherwise, for HRA, the Location_Name
// must be mapped from the index and the date is extrated from 'Week_End'.
function mergeXlsData(combinedData, inputData, dailyDate) {
  // Dataset is City, ZIP, HRA, and Census.
  for (datasetName of Object.keys(inputData)) {
    const dataset = inputData[datasetName];
    const header = dataset[0];
    const rows = dataset.slice(1);

    // -1 if dailyDate is set.
    const dateIndex = header.indexOf('Week_End');
    const locationNameIndex = header.indexOf('Location_Name');

    const peopleTestedIndex = header.indexOf('People_Tested');
    const allTestResultsIndex = header.indexOf('All_Test_Results');
    const positivesIndex = header.indexOf('Positives');
    const hospitalizationsIndex = header.indexOf('Hospitalizations');
    const deathsIndex = header.indexOf('Deaths');

    const populationIndex = header.indexOf('Population');

    const data = combinedData[datasetName] = combinedData[datasetName] || {};
    for (row of rows) {
      let locationName = null;
      if (locationNameIndex !== -1) {
        locationName = row[locationNameIndex];
      } else {
        // If it's the biweekly data file, then the second column is the
        // the locaion. But if it is the HRA, it needs to be mapped.
        locationName = row[1];
        if (datasetName === 'HRA') {
          locationName = idToHra[locationName];
        }
      }

      const entry = data[locationName] = data[locationName] || {
        date: [],
        peopleTested: [],
        allTestResults: [],
        positives: [],
        hospitalizations: [],
        deaths: [],
      };

      if (datasetName === 'HRA') {
        entry.hraId = hraToId[locationName];
      }

      if (dailyDate) {
        entry.date.push(dailyDate.getTime());
      } else {
        entry.date.push(row[dateIndex]);
      }

      accumulateCount(entry.peopleTested, row[peopleTestedIndex], !dailyDate);
      accumulateCount(entry.allTestResults, row[allTestResultsIndex], !dailyDate);
      accumulateCount(entry.positives, row[positivesIndex], !dailyDate);
      accumulateCount(entry.hospitalizations, row[hospitalizationsIndex], !dailyDate);
      accumulateCount(entry.deaths, row[deathsIndex], !dailyDate);

      if (populationIndex !== -1) {
        // This doesn't seem to get updated frequently so treat it as a constant.
        entry.population = row[populationIndex];
      }
    }
  }
}

function mergeOne(data, b, name, dateTs) {
  data[name].date.push(dateTs);
  data[name].positives.push(b[name].positives);
  data[name].totalTests.push(b[name].totalTests);
  data[name].deaths.push(b[name].deaths);
  data[name].hospitalizations.push(b[name].hospitalizations);
  data[name].peopleTested.push(b[name].peopleTested);
}

function mergeData(normalized, update, dateTs) {
  for (const name of Object.keys(normalized)) {
    if (name in update) {
      mergeOne(normalized, update, name, dateTs);
    }
  }
  return normalized;
}

module.exports = {
  mergeXlsData,
  mergeOne,
  mergeData,
}
