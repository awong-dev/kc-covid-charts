import { addDays } from 'date-fns'
import { useCallback } from 'react';
import { LinePath, Circle } from '@visx/shape';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { GridRows, GridColumns } from '@visx/grid';
import { voronoi, VoronoiPolygon } from '@visx/voronoi';
import { Group } from '@visx/group';
import { flatten, sortBy } from 'lodash';
import { min, max, extent } from 'd3-array';
import {
  memo,
  useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import useResizeObserver from '@react-hook/resize-observer';
import {
  Tooltip,
  TooltipWithBounds,
  useTooltip,
  useTooltipInPortal,
  defaultStyles,
} from '@visx/tooltip';

const margins = {
  top: 20,
  right: 50,
  bottom: 30,
  left: 80,
};

const tooltipNumberFormatter = new Intl.NumberFormat('en-US', {maximumFractionDigits: 0})
const tooltipDateFormatter = new Intl.DateTimeFormat('en-US', {dateStyle: 'medium'})

export default function TimeSeries({
  state: { hras },
  heading,
  valueAccessor,
}) {
  const target = useRef(null);

  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const forceUpdate = useResizeObserver(target, () => {
    if (!target.current) { return; }
    const rect = target.current.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
  });

  const [diagramWidth, diagramHeight] = useMemo(() => [
    width - margins.left - margins.right,
    height - margins.top - margins.bottom,
  ], [width, height, margins, hras]);

  const activeHRAs = useMemo(() => {
    return Object.values(hras).filter(({ active }) => active)
  }, [hras])

  const [timeScale, valueScale] = useMemo(() => {
    const firstHra = activeHRAs[0];
    const timeDomain = firstHra ? extent(firstHra.timeSeries, (d) => d.date) : undefined;
    return [
      scaleTime({
        domain: timeDomain,
        range: [0, diagramWidth],
        nice: true,
      }),
      scaleLinear({
        domain: [
          min(activeHRAs, (hra) => min(hra.timeSeries, valueAccessor)),
          max(activeHRAs, (hra) => max(hra.timeSeries, valueAccessor))
        ],
        range: [diagramHeight, 0],
        nice: true,
      }),
    ];
  }, [activeHRAs, diagramHeight]);

  const voronoiPolygons = useMemo(
    () => {
      // merge HRA-specific data into a list of data points, then flatten the list to include all HRAs' data points:
      const points = flatten(activeHRAs.map(({timeSeries, ...hra}) => timeSeries.map(d => ({...d, hra}))))
        // only finite points:
        .filter(point => isFinite(valueAccessor(point)))
        // compute the x and y point here (rather than in the voronoi definition)
        // because it'll be handy for positioning the tooltip:
        .map(d => ({
          ...d,
          x: timeScale(d.date),
          y: valueScale(valueAccessor(d)),
          value: valueAccessor(d),
        }));

      console.warn(points)
      
      const voronoiDiagram = voronoi({
        x: (d) => d.x,
        y: (d) => d.y,
        width: diagramWidth,
        height: diagramHeight,
      })(points)
      return voronoiDiagram.polygons()
    }, [diagramWidth, diagramHeight, activeHRAs],
  );
  
  const {
    showTooltip,
    hideTooltip,
    tooltipOpen,
    tooltipData,
    tooltipLeft = 0,
    tooltipTop = 0,
  } = useTooltip({
    tooltipOpen: false,
    tooltipLeft: 200,
    tooltipTop: 100,
    tooltipData: null,
  });

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    // use TooltipWithBounds
    detectBounds: true,
    // when tooltip containers are scrolled, this will correctly update the Tooltip position
    scroll: true,
    debounce: 100
  })

  return (
    <figure className="flex-1 flex flex-col bg-gray-100">
      <figcaption className="ml-8 mt-4 text-3xl font-bold">{heading}</figcaption>
      <div className="flex-1 flex relative" ref={containerRef}>
        <svg ref={target} className="flex-1">
          <Group left={margins.left} top={margins.top}>
            <Framing
              valueScale={valueScale}
              timeScale={timeScale}
              diagramWidth={diagramWidth}
              diagramHeight={diagramHeight}
              heading={heading}
            />
            {tooltipOpen &&
              <rect
                x={timeScale(addDays(tooltipData.date, -1))}
                y={0}
                height={diagramHeight}
                width={timeScale(addDays(tooltipData.date, 1)) - timeScale(addDays(tooltipData.date, -1))}
                r={5}
                fill="black"
                fillOpacity={0.2}
                className="pointer-events-none"
              />
            }

            {activeHRAs.map(({ hraId, timeSeries, color }) => {
              return (
                <HRALine
                  timeSeries={timeSeries}
                  timeScale={timeScale}
                  valueScale={valueScale}
                  valueAccessor={valueAccessor}
                  color={color}
                />
              );
            })}
            <g>
              {voronoiPolygons.map((polygon, i) => (
                <HoverableVoronoiPolygon
                  key={polygon.data.hraId}
                  polygon={polygon}
                  showTooltip={showTooltip}
                  hideTooltip={hideTooltip}
                />
              ))}
            </g>
            {tooltipOpen &&
              <Circle
                cx={tooltipData.x}
                cy={tooltipData.y}
                r={5}
                fill="none"
                stroke={tooltipData.hra.color}
                strokeWidth="2"
                className="pointer-events-none"
              />
            }
          </Group>
        </svg>
        {tooltipOpen &&
          <TooltipInPortal
            left={tooltipLeft}
            top={tooltipTop}
            className="pointer-events-none"
            unstyled
            applyPositionStyle
          >
            <div className="bg-white shadow shadow-xl px-2 rounded border-l-4" style={{borderColor: tooltipData.hra.color}}>
              <div>
                {tooltipData.hra.name}
              </div>
              <div className="text-2xl font-bold -my-2">
                {tooltipNumberFormatter.format(tooltipData.value)}
              </div>
              <div>
                {tooltipDateFormatter.format(tooltipData.date)}
              </div>
            </div>
          </TooltipInPortal>
        }
      </div>
    </figure>
  );
}

const Framing = memo(
  ({
    valueScale, timeScale, diagramWidth, diagramHeight, heading,
  }) => (
    <>
      <GridRows scale={valueScale} width={diagramWidth} height={diagramHeight} stroke="#d0d0d0" numTicks={5} />
      <GridColumns scale={timeScale} width={diagramWidth} height={diagramHeight} stroke="#d0d0d0" />
      <line x1={diagramWidth} x2={diagramWidth} y1={0} y2={diagramHeight} stroke="#d0d0d0" />
      <AxisBottom top={diagramHeight} scale={timeScale} />
      <AxisLeft scale={valueScale} numTicks={5} />
    </>
  ),
);

const HRALine = memo(
  ({
    timeSeries, timeScale, valueScale, valueAccessor, color
  }) => (
    <g>
      <LinePath
        data={timeSeries}
        x={(d) => timeScale(d.date)}
        y={(d) => valueScale(valueAccessor(d))}
        stroke={color}
        strokeWidth={2}
        strokeOpacity={1}
        strokeLinejoin="round"
        strokeLinecap="round"
        defined={(d) => Number.isFinite(valueAccessor(d))}
      />
    </g>
  ),
);

const HoverableVoronoiPolygon = ({polygon, showTooltip, hideTooltip}) => {
  const handleMouseEnter = useCallback(() => (showTooltip({
    tooltipData: polygon.data,
    tooltipLeft: polygon.data.x + margins.left,
    tooltipTop: polygon.data.y + margins.top,
  })), [polygon, showTooltip]);
  const handleMouseLeave = hideTooltip; // TODO verify that this method is memoized i guess

  return <VoronoiPolygon
  key={3}
  polygon={polygon}
  style={{fill: 'green', fillOpacity: 0}}
    onMouseEnter={handleMouseEnter}
    onMouseLeave={handleMouseLeave}
  />
}