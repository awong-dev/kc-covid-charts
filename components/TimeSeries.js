import { useMemo } from "react";
import {
  AnimatedAxis,
  AnimatedLineSeries,
  XYChart,
  Tooltip,
  AnimatedGrid,
  buildChartTheme,
} from "@visx/xychart";

const tooltipNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumSignificantDigits: 3,
});
const tooltipDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

export default function TimeSeries({
  state: { hras },
  heading,
  valueAccessor,
}) {
  const activeHRAs = useMemo(() => {
    return Object.values(hras).filter(({ active }) => active);
  }, [hras]);

  return (
    <figure className="flex-1 flex flex-col bg-gray-100">
      <figcaption className="ml-8 mt-4 text-3xl font-bold">
        {heading}
      </figcaption>
      <div className="flex-1 flex relative">
        {activeHRAs[0] && (
          <XYChart
            xScale={{ type: "linear", nice: true }}
            yScale={{ type: "linear", nice: true }}
            margin={{ top: 20, right: 50, bottom: 30, left: 80 }}
            theme={buildChartTheme({
              backgroundColor: "#fff",
              colors: activeHRAs.map(({ color }) => color),
              tickLength: 4,
              gridColor: "#ccc",
              gridColorDark: "#333",
            })}
          >
            <AnimatedAxis
              orientation="bottom"
              tickFormat={tooltipDateFormatter.format}
            />
            <AnimatedAxis orientation="left" />
            <AnimatedGrid columns={false} />
            {activeHRAs.map(({ hraId, timeSeries, color }) => {
              return (
                <AnimatedLineSeries
                  data={timeSeries}
                  dataKey={hraId}
                  xAccessor={(d) => d.date} // TODO useCallback
                  yAccessor={valueAccessor}
                />
              );
            })}
            <Tooltip
              snapTooltipToDatumX
              snapTooltipToDatumY
              showVerticalCrosshair
              showSeriesGlyphs
              renderTooltip={({ tooltipData, colorScale }) => (
                <div>
                  <div className="text-lg font-bold">
                    {tooltipDateFormatter.format(
                      tooltipData.nearestDatum.datum.date
                    )}
                  </div>
                  {Object.entries(tooltipData.datumByKey)
                      .sort(([_, a], [__, b]) => valueAccessor(b.datum) - valueAccessor(a.datum))
                      .map(
                    ([hraId, { datum }]) => (
                      <p
                        className="border-l-8 pl-1 font-normal tracking-tight mb-0.5"
                        style={{ borderColor: colorScale(hraId) }}
                      >
                        {hras[hraId].name}:
                        {' '}
                        <span className="font-bold">
                          {tooltipNumberFormatter.format(valueAccessor(datum))}
                        </span>
                      </p>
                    )
                  )}
                </div>
              )}
            />
          </XYChart>
        )}
      </div>
    </figure>
  );
}
