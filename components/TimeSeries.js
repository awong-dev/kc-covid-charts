import { useCallback } from 'react';
import { LinePath, Circle } from '@visx/shape';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { GridRows, GridColumns } from '@visx/grid';
import { voronoi, VoronoiPolygon } from '@visx/voronoi';
import { Group } from '@visx/group';
import { flatten, sortBy } from 'lodash';
import { max, extent } from 'd3-array';
import {
  memo,
  useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import useResizeObserver from '@react-hook/resize-observer';

const margins = {
  top: 70,
  right: 50,
  bottom: 50,
  left: 80,
};

export default function TimeSeries({
  state: { hras, hoveredHraId },
  heading,
  valueAccessor,
  setHoveredHraId,
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
        domain: [0, max(activeHRAs, (hra) => max(hra.timeSeries, valueAccessor))],
        range: [diagramHeight, 0],
        nice: true,
      }),
    ];
  }, [activeHRAs, diagramHeight]);

  const voronoiPolygons = useMemo(
    () => {
      const points = flatten(activeHRAs.map(({timeSeries, hraId}) => timeSeries.map(t => ({...t, hraId}))))
        .filter(point => isFinite(valueAccessor(point)));
      const voronoiDiagram = voronoi({
        x: (d) => timeScale(d.date),
        y: (d) => valueScale(valueAccessor(d)),
        width: diagramWidth,
        height: diagramHeight,
      })(points)
      return voronoiDiagram.polygons()
    }, [diagramWidth, diagramHeight, activeHRAs],
  );
  

  return (
    <svg ref={target} className="bg-gray-100 flex-1">
      <Group left={margins.left} top={margins.top}>
        <Framing
          valueScale={valueScale}
          timeScale={timeScale}
          diagramWidth={diagramWidth}
          diagramHeight={diagramHeight}
          heading={heading}
        />
        {sortBy(activeHRAs, h => h.hraId === hoveredHraId).map(({ hraId, timeSeries }) => {
          const isHovered = hraId === hoveredHraId;
          return (
            <HRALine
              timeSeries={timeSeries}
              timeScale={timeScale}
              valueScale={valueScale}
              valueAccessor={valueAccessor}
              isHovered={isHovered}
            />
          );
        })}
        <g>
          {voronoiPolygons.map((polygon, i) => (
            <HoverableVoronoiPolygon key={i /* TK */} polygon={polygon} setHoveredHraId={setHoveredHraId} />
          ))}
        </g>
      </Group>
    </svg>
  );
}

const Framing = memo(
  ({
    valueScale, timeScale, diagramWidth, diagramHeight, heading,
  }) => (
    <>
      <text x={0} y={-25} fontSize={30}>
        {heading}
      </text>
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
    timeSeries, timeScale, valueScale, valueAccessor, isHovered,
  }) => (
    <g className={isHovered ? 'text-yellow-500' : 'text-black'}>
      <LinePath
        data={timeSeries}
        x={(d) => timeScale(d.date)}
        y={(d) => valueScale(valueAccessor(d))}
        className="stroke-current"
        strokeWidth={isHovered ? 3 : 0.5}
        strokeOpacity={0.8}
        defined={(d) => Number.isFinite(valueAccessor(d))}
      />
      {timeSeries.map((d) => {
        const value = valueAccessor(d);
        if (!Number.isFinite(value)) { return null; }
        return (
          <Circle
            key={d.date}
            cx={timeScale(d.date)}
            cy={valueScale(value)}
            r={isHovered ? 3 : 1}
            className="fill-current"
          />
        );
      })}
    </g>
  ),
);

const HoverableVoronoiPolygon = ({polygon, setHoveredHraId}) => {
  const handleMouseEnter = useCallback(() => setHoveredHraId(polygon.data.hraId), [polygon, setHoveredHraId]);
  const handleMouseLeave = useCallback(() => setHoveredHraId(null), [setHoveredHraId]);

  return <VoronoiPolygon
  key={3}
  polygon={polygon}
  style={{fill: 'green', fillOpacity: 0, strokeWidth: 0}}
    onMouseEnter={handleMouseEnter}
    onMouseLeave={handleMouseLeave}
  />
}