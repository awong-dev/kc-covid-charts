const _ = require('lodash');
const origData = require('./' + process.argv[2]);

console.log(JSON.stringify(
  _.mapValues(origData,
    (location) => _.mapValues(
      location,
      (points) => _.mapValues(points, (ar) => _.shuffle(ar).slice(0,10)),
    )),
  null, 2,
));
