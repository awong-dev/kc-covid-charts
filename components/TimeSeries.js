import { LinePath, Circle } from '@visx/shape';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { GridRows, GridColumns } from '@visx/grid';
import { Group } from '@visx/group';
import { zipWith } from 'lodash';
import { max, extent } from 'd3-array';
import {
  memo,
  useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import useResizeObserver from '@react-hook/resize-observer';

const margins = {
  top: 70,
  right: 20,
  bottom: 50,
  left: 80,
};

export default function TimeSeries({
  state: { hras, hoveredHraId },
  heading,
  valueAccessor,
}) {
  const target = useRef(null);
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const forceUpdate = useResizeObserver(target, () => {
    if (!target.current) { return; }
    const rect = target.current.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
  }, []);

  const [diagramWidth, diagramHeight, activeHRAs] = useMemo(() => [
    width - margins.left - margins.right,
    height - margins.top - margins.bottom,
    Object.values(hras).filter(({ active }) => active),
  ], [width, height, margins, hras]);

  const [timeScale, valueScale] = useMemo(() => [
    scaleTime({
      domain: extent(activeHRAs[0].timeSeries, (d) => d.date),
      range: [0, diagramWidth],
      nice: true,
    }),
    scaleLinear({
      domain: [0, max(activeHRAs, (hra) => max(hra.timeSeries, valueAccessor))],
      range: [diagramHeight, 0],
      nice: true,
    }),
  ], [activeHRAs, diagramHeight]);

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
        {activeHRAs.map(({ hraId, timeSeries }) => {
          const isHovered = hraId === hoveredHraId;
          console.warn('ISHOVERED:', isHovered, hraId, hoveredHraId);
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
      <GridRows scale={valueScale} width={diagramWidth} height={diagramHeight} stroke="#d0d0d0" />
      <GridColumns scale={timeScale} width={diagramWidth} height={diagramHeight} stroke="#d0d0d0" />
      <line x1={diagramWidth} x2={diagramWidth} y1={0} y2={diagramHeight} stroke="#d0d0d0" />
      <AxisBottom top={diagramHeight} scale={timeScale} />
      <AxisLeft scale={valueScale} />
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
        strokeWidth={1.5}
        strokeOpacity={0.8}
        defined={(d) => Number.isFinite(valueAccessor(d))}
      />
      {timeSeries.map((d) => (
        <Circle
          key={d.date}
          cx={timeScale(d.date)}
          cy={valueScale(valueAccessor(d))}
          r={3}
          className="fill-current"
        />
      ))}
    </g>
  ),
);
