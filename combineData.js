const fs = require('fs');
const _ = require('lodash');
const combined = require('./data-hra.json');
const { mergeData } = require('./functions/mergedata.js');
const hra = require('./functions/hras.js');
const nov15 = require('./data/nov-15-scrape.json');
const nov16 = require('./data/nov-16-scrape.json');
const nov17 = require('./data/nov-17-scrape.json');
const nov20 = require('./data/nov-20-scrape.json');
const nov21 = require('./data/nov-21-scrape.json');

const Missing = Object.keys(_.pickBy(hra.mapScrapHraToHra, (v, k) => v !== k));

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
  const val = _.mapValues(data, (o) => {
    const x = {
      date: o.date,
      peopleTested: o.peopleTested,
      hospitalizations: o.hospitalizations,
      deaths: o.deaths,
      positives: o.positives,
      totalTests: o.allTestResults,
    };
    if (o.population) {
      x.population = o.population;
    }
    return x;
  });
  delete val['All King County'];
  return val;
}

const nov15Date = new Date('Nov 15 2020 PST').getTime();
const nov16Date = new Date('Nov 16 2020 PST').getTime();
const nov17Date = new Date('Nov 17 2020 PST').getTime();
const nov20Date = new Date('Nov 20 2020 PST').getTime();
const nov21Date = new Date('Nov 21 2020 PST').getTime();

function isMissing(v, k) {
  return Missing.includes(k);
}

function adaptMissing(data) {
  return _.mapKeys(
    _.pickBy(data, isMissing),
    (v, k) => hra.mapScrapHraToHra[k],
  );
}

function mergeType(data, type, secondType) {
  const normalized = data;
  mergeData(normalized, adaptMissing(nov15[secondType]), nov15Date);
  mergeData(normalized, adaptMissing(nov16[secondType]), nov16Date);
  mergeData(normalized, adaptMissing(nov17[secondType]), nov17Date);
  mergeData(normalized, adaptMissing(nov20[secondType]), nov20Date);
  mergeData(normalized, adaptMissing(nov21[secondType]), nov21Date);
  return normalized;
}

function split() {
  const hra = mergeType(combined, 'HRA', 'hra');
  fs.writeFileSync('data-hra-new.json', JSON.stringify(hra));
}

split();
