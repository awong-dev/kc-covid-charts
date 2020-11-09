import { LinePath, Circle } from '@visx/shape';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { GridRows, GridColumns } from '@visx/grid';
import { Group } from '@visx/group';
import { zipWith } from 'lodash';
import { max } from 'd3-array';

const width = 800 // TODO
const height = 450 // TODO
const margins = {
  top: 50,
  right: 50,
  bottom: 50,
  left: 50
}

const diagramWidth = width - margins.left - margins.right
const diagramHeight = height - margins.top - margins.bottom

export default function TimeSeries({locationData}) {
  const data = zipWith(locationData['Auburn North'].date, locationData['Auburn North'].peopleTested, (date, peopleTested) => ({date: (new Date(date)), peopleTested}))

  const timeScale = scaleTime({
    domain: [new Date('2020'), new Date('2021')], // TODO
    range: [0, diagramWidth],
  });
  const peopleTestedScale = scaleLinear({
    domain: [0, max(data, d => d.peopleTested)],
    range: [diagramHeight, 0],
    nice: true,
  });
  
  return (
    <div>
      <svg width={width} height={height}>
        <Group left={margins.left} top={margins.top}>
          <GridRows scale={peopleTestedScale} width={diagramWidth} height={diagramHeight} stroke="#e0e0e0" />
          <GridColumns scale={timeScale} width={diagramWidth} height={diagramHeight} stroke="#e0e0e0" />
          <line x1={diagramWidth} x2={diagramWidth} y1={0} y2={diagramHeight} stroke="#e0e0e0" />
          <AxisBottom top={diagramHeight} scale={timeScale} />
          <AxisLeft scale={peopleTestedScale} />
          <text x="-70" y="15" transform="rotate(-90)" fontSize={10}>
            People tested
          </text>
          <LinePath
            data={data}
            x={d => timeScale(d.date)}
            y={d => peopleTestedScale(d.peopleTested)}
            stroke="#222"
            strokeWidth={1.5}
            strokeOpacity={0.8}
            strokeDasharray="1,2"
          />
          {data.map(({date, peopleTested}, i) => (
            <Circle
              key={i}
              cx={timeScale(date)}
              cy={peopleTestedScale(peopleTested)}
              r={3}
              fill="#f6c431"
            />
          ))}
        </Group>
      </svg>
    </div>
  )

}