export default function DataTable({ locationType, covidData }) {
  const dates = new Set();
  for (const it of Object.values(covidData)) {
    it.date.forEach(d => dates.add(d));
  }
  const sortedDates = dates.values();
//  sortedDates.sort();
  const headerRow = [<th key={'location-name'}>{locationType}</th>];
  const rows = [];
  for (const ts of sortedDates) {
    headerRow.push(<th key={`h-${ts}`}>{(new Date(ts)).toDateString()}</th>);
  }
  for (const [location, data] of Object.entries(covidData)) {
    const r = [<td key={`d-${location}`}>{location}</td>];
    for (let i = 0; i < data.date.length; i++) {
      let delta_p = data.positives[i];
      let delta_t = data.allTestResults[i];
      if (i > 0) {
        delta_p = delta_p - data.positives[i-1];
        delta_t = delta_t - data.allTestResults[i-1];
      }
      // TODO(awong): HACK to avoid div by 0.
      const p_rate = Math.round(delta_p/(delta_t+.0001) * 10000)/100;
      r.push(<td key={`${location}-${data.date[i]}`}> {p_rate} </td>);
    }
    rows.push(<tr key={`r-${location}`}>{r}</tr>);
  }
  
  return (
    <div>
      <table border="1">
        <tr>
          {headerRow}
        </tr>
        {rows}
      </table>
    </div>
  );
}

