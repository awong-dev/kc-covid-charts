import TimeSeries from '../components/TimeSeries';
import HRAList from '../components/HRAList';
import Map from '../components/Map';
import useCombinedState from '../hooks/useCombinedState';

export default function CombinedChart({ covidData }) {
  const {
    state, toggleActive, setHoveredHraId,
  } = useCombinedState(covidData);

  return (
    <main className="p-4 h-full w-full min-h-screen flex flex-row items-stretch justify-items-stretch bg-purple-100 space-x-4">
      <div className="w-1/4 flex flex-col items-stretch justify-start space-y-4">
        <div className="h-1/4 overflow-hidden shadow-lg flex items-stretch justify-items-stretch overflow-hidden">
          <Map state={state} toggleActive={toggleActive} />
        </div>
        <div className="flex-stretch shadow-lg">
          <HRAList
            state={state}
            toggleActive={toggleActive}
            setHoveredHraId={setHoveredHraId}
          />
        </div>
      </div>
      <div className="flex-grow flex flex-col items-stretch justify-start space-y-4">
        <div className="h-80 flex overflow-hidden shadow-lg">
          <TimeSeries state={state} heading="People tested" valueAccessor={(d) => d.peopleTested} />
        </div>
        <div className="h-80 flex overflow-hidden shadow-lg">
          <TimeSeries state={state} heading="Positives per population" valueAccessor={(d) => (d.positives / d.population)} />
        </div>
        <div className="h-80 flex overflow-hidden shadow-lg">
          <TimeSeries state={state} heading="Positives per test" valueAccessor={(d) => (d.positives / d.allTestResults || 0)} />
        </div>
        <div className="h-80 flex overflow-hidden shadow-lg">
          <TimeSeries state={state} heading="Hospitalizations" valueAccessor={(d) => (d.hospitalizations)} />
        </div>
        <div className="h-80 flex overflow-hidden shadow-lg">
          <TimeSeries state={state} heading="Deaths" valueAccessor={(d) => (d.deaths)} />
        </div>
      </div>
    </main>
  );
}

export async function getStaticProps() {
  const res = await fetch('https://firebasestorage.googleapis.com/v0/b/kc-covid-chart.appspot.com/o/processed%2Fdata.json?alt=media&token=18ebf1ec-4143-4272-9b3a-4bee6c62793e');
  const covidData = await res.json();

  return {
    props: {
      covidData,
    },
    revalidate: 1, // In seconds
  };
}
