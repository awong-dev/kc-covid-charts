import TimeSeries from '../components/TimeSeries';
import HRAList from '../components/HRAList';
import Map from '../components/Map';
import useCombinedState from '../hooks/useCombinedState';

export default function CombinedChart({ covidData }) {
  const {
    state, toggleActive, setHoveredHraId, setAllInactive
  } = useCombinedState(covidData);

  return (
    <main className="p-4 h-full w-full min-h-screen flex flex-row items-stretch justify-items-stretch bg-purple-100 space-x-4">
      <div className="w-1/4 flex flex-col items-stretch justify-start space-y-4">
        <div className="h-60 overflow-hidden shadow-lg flex items-stretch justify-items-stretch overflow-hidden">
          <Map
            state={state}
            toggleActive={toggleActive}
            setHoveredHraId={setHoveredHraId}
          />
        </div>
        <div className="flex-stretch shadow-lg">
          <HRAList
            state={state}
            toggleActive={toggleActive}
            setHoveredHraId={setHoveredHraId}
            setAllInactive={setAllInactive}
          />
        </div>
      </div>
      <div className="flex-grow flex flex-col items-stretch justify-start space-y-4">
        <div className="h-80 flex overflow-hidden shadow-lg">
          <TimeSeries
            state={state}
            heading="New positives per 100k"
            valueAccessor={(d) => (100000 * d.Δpositives / d.population)}
            setHoveredHraId={setHoveredHraId}
          />
        </div>
        <div className="h-80 flex overflow-hidden shadow-lg">
          <TimeSeries
            state={state}
            heading="Positives per people tested"
            valueAccessor={(d) => (d.Δpositives / d.ΔpeopleTested)}
            setHoveredHraId={setHoveredHraId}
          />
        </div>
        <div className="h-80 flex overflow-hidden shadow-lg">
          <TimeSeries
            state={state}
            heading="Tests"
            valueAccessor={(d) => (d.ΔtotalTests)}
            setHoveredHraId={setHoveredHraId}
          />
        </div>
        <div className="h-80 flex overflow-hidden shadow-lg">
          <TimeSeries
            state={state}
            heading="Deaths"
            valueAccessor={(d) => (d.Δdeaths)}
            setHoveredHraId={setHoveredHraId}
          />
        </div>
      </div>
    </main>
  );
}

export async function getStaticProps() {
  const res = await fetch('https://storage.googleapis.com/kc-covid-chart.appspot.com/processed/data-hra.json');
  const hraData = await res.json();

  return {
    props: {
      covidData: { HRA: hraData },
    },
    revalidate: 1, // In seconds
  };
}
