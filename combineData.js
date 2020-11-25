const fs = require('fs');
const combined = require('./data.json');
const _ = require('lodash');
const nov15 = require('./data/nov-15-scrape.json');
const nov16 = require('./data/nov-16-scrape.json');
const nov17 = require('./data/nov-17-scrape.json');
const nov20 = require('./data/nov-20-scrape.json');
const nov21 = require('./data/nov-21-scrape.json');

// Target format should be
//  { 
//    "name": {
//      "date": [ 1234, 2345, 2566 ],
//      "peopleTested": [ 10, 20, 30 ],
//      "hospitalizations": [ 1, 2, 2 ],
//      "deaths": [ 3, 4, 4 ],
//      "totalTests": [ 12, 22, 34 ],
//      "positives": [ 2, 2, 3 ],
//     },
//  } 


// Input format is
//  { 
//    "name": {
//      "date": [ 1234, 2345, 2566 ],
//      "peopleTested": [ 10, 20, 30 ],
//      "hospitalizations": [ 1, 2, 2 ],
//      "deaths": [ 3, 4, 4 ],
//      "allTestResults": [ 12, 22, 34 ],
//      "positives": [ 2, 2, 3 ],
//     },
//  } 
function combinedToNormal(data) {
  const val = _.mapValues(data, o => {
    const x = {
      date: o.date,
      peopleTested: o.peopleTested,
      hospitalizations: o.hospitalizations,
      deaths: o.deaths,
      positives: o.positives,
      totalTests: o.allTestResults,
    };
    if (o['population']) {
      x['population'] = o['population'];
    }
    return x;
  });
  delete val['All King County'];
  return val;
}

const nov15Date = (new Date('Nov 15 2020 PST')).getTime();
const nov16Date = (new Date('Nov 16 2020 PST')).getTime();
const nov17Date = (new Date('Nov 17 2020 PST')).getTime();
const nov20Date = (new Date('Nov 20 2020 PST')).getTime();
const nov21Date = (new Date('Nov 21 2020 PST')).getTime();

function mergeType(data, type, secondType) {
  let normalized = combinedToNormal(data[type]);
  if (type === 'Census') {
/*
    // Census Tract is actually just one data point in Census, incorrectly merged.
    let tractData = combinedToNormal(data['Census Tract']);
    _.merge(normalized, tractData);
*/
    // Rip the 533030 off the front of the census number.
    normalized = _.mapKeys(normalized, (v,k) => k.slice(6)/100);
  }
  mergeData(normalized, nov15[secondType], nov15Date);
  mergeData(normalized, nov16[secondType], nov16Date);
  mergeData(normalized, nov17[secondType], nov17Date);
  mergeData(normalized, nov20[secondType], nov20Date);
  mergeData(normalized, nov21[secondType], nov21Date);
  return normalized;
}

function split() {
  const city = mergeType(combined, 'City', 'city');
  const hra = mergeType(combined, 'HRA', 'hra');
  const zip = mergeType(combined, 'ZIP', 'zip');
  const census = mergeType(combined, 'Census', 'census');
  fs.writeFileSync('data-city.json', JSON.stringify(city, null, 2));
  fs.writeFileSync('data-hra.json', JSON.stringify(hra, null, 2));
  fs.writeFileSync('data-zip.json', JSON.stringify(zip, null, 2));
  fs.writeFileSync('data-census.json', JSON.stringify(census, null, 2));
}

split();
