const idToHra = {
  '1000': 'Auburn North',
  '1100': 'Auburn South',
  '2000': 'Ballard',
  '2100': 'Beacon Gtown S Park',
  '2200': 'Capitol Hill E lake',
  '2300': 'Central Seattle',
  '2400': 'Delridge',
  '2500': 'Downtown',
  '2550': 'Fremont Greenlake',
  '2600': 'NE Seattle',
  '2700': 'North Seattle',
  '2800': 'NW Seattle',
  '2900': 'QA Magnolia',
  '2950': 'SE Seattle',
  '2960': 'West Seattle',
  '3000': 'Bear Creek Carnation Duvall',
  '4000': 'Bellevue Central',
  '4100': 'Bellevue NE',
  '4200': 'Bellevue South',
  '4300': 'Bellevue West',
  '5000': 'Black Diamond Enumclaw SE County',
  '6000': 'Bothell Woodinville',
  '7000': 'Burien',
  '8000': 'Covington Maple Valley',
  '9000': 'Des Moines Normandy Park',
  '10000': 'East Federal Way',
  '10100': 'Fed Way Central Military Rd',
  '10200': 'Fed Way Dash Point Woodmont',
  '11000': 'Fairwood',
  '12000': 'Issaquah',
  '13000': 'Kenmore LFP',
  '14000': 'Kent East',
  '14100': 'Kent SE',
  '14200': 'Kent West',
  '15000': 'Kirkland',
  '15100': 'Kirkland North',
  '16000': 'Mercer Isle Pt Cities',
  '17000': 'Newcastle Four Creeks',
  '18000': 'North Highline',
  '19000': 'Redmond',
  '20000': 'Renton East',
  '20100': 'Renton North',
  '20200': 'Renton South',
  '21000': 'Sammamish',
  '22000': 'SeaTac Tukwila',
  '23000': 'Shoreline',
  '24000': 'Snoqualmie North Bend Skykomish',
  '25000': 'Vashon Island',
  null: 'All King County'
};

const hraToId = {
  'All King County': null,
  'Auburn North': 1000,
  'Auburn South': 1100,
  Ballard: 2000,
  'Beacon Gtown S Park': 2100,
  'Capitol Hill E lake': 2200,
  'Central Seattle': 2300,
  Delridge: 2400,
  Downtown: 2500,
  'Fremont Greenlake': 2550,
  'NE Seattle': 2600,
  'North Seattle': 2700,
  'NW Seattle': 2800,
  'QA Magnolia': 2900,
  'SE Seattle': 2950,
  'West Seattle': 2960,
  'Bear Creek Carnation Duvall': 3000,
  'Bellevue Central': 4000,
  'Bellevue NE': 4100,
  'Bellevue South': 4200,
  'Bellevue West': 4300,
  'Black Diamond Enumclaw SE County': 5000,
  'Bothell Woodinville': 6000,
  Burien: 7000,
  'Covington Maple Valley': 8000,
  'Des Moines Normandy Park': 9000,
  'East Federal Way': 10000,
  'Fed Way Central Military Rd': 10100,
  'Fed Way Dash Point Woodmont': 10200,
  Fairwood: 11000,
  Issaquah: 12000,
  'Kenmore LFP': 13000,
  'Kent East': 14000,
  'Kent SE': 14100,
  'Kent West': 14200,
  Kirkland: 15000,
  'Kirkland North': 15100,
  'Mercer Isle Pt Cities': 16000,
  'Newcastle Four Creeks': 17000,
  'North Highline': 18000,
  Redmond: 19000,
  'Renton East': 20000,
  'Renton North': 20100,
  'Renton South': 20200,
  Sammamish: 21000,
  'SeaTac Tukwila': 22000,
  Shoreline: 23000,
  'Snoqualmie North Bend Skykomish': 24000,
  'Vashon Island': 25000
};

module.exports = { idToHra, hraToId };
