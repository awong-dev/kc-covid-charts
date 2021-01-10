import { chain, zip, mapValues, includes, remove } from 'lodash';
import { useCallback, useReducer, useMemo } from 'react';
import { addDays, differenceInMilliseconds, differenceInHours } from 'date-fns'
import { schemeTableau10 } from 'd3-scale-chromatic'
import { mean } from 'd3-array'

/*
interface State {
  hras: {
    [hraId]: {
      hraId: number
      name: string
      active: boolean
      // color — only used when active, or when going back to an active state and trying to preserve color:
      color: string | undefined
    }
  }
  unusedColors: [string] // most recently used at the end
}
*/

const reducer = (state, action) => {
  switch(action.type) {
    case 'TOGGLE_ACTIVE':
      const hra = state.hras[action.hraId]
      const active = !state.hras[action.hraId].active
      let color = hra.color
      const unusedColors = [...state.unusedColors]
      if (active) {
        if (unusedColors.length === 0) { return state } // HACK
        // see if the hra has a preferred color that is not used:
        if (color && includes(unusedColors, color)) {
          remove(unusedColors, c => c === color)
        }
        // or just take the least recently used one:
        else {
          color = unusedColors.shift()
        }
      } else {
        unusedColors.push(hra.color)
      }
      const result = {
        ...state,
        hras: {...state.hras, [action.hraId]: {...hra, active, color}},
        unusedColors,
      }
      return result;
    case 'SET_ALL_INACTIVE':
      return {
        ...state,
        hras: mapValues(state.hras, (hra) => ({...hra, active: false})),
        unusedColors: [...schemeTableau10],
      }
    case 'SET_HOVER':
      return {...state, hoveredHraId: action.hraId}
    break;
  }
}

const interpolatedFields = [
  'population',
  'peopleTested',
  'totalTests',
  'positives',
  'hospitalizations',
  'deaths',
]

const smoothingWindowInDays = 7

const buildDefaultState = (covidData) => {
  const covidDataByHraId = chain(Object.entries(covidData.HRA))
    .filter(([_, {hraId}]) => !!hraId)
    .keyBy(([_, {hraId}]) => Number(hraId))
    .mapValues(([hraName, { hraId, population, date, peopleTested, totalTests, positives, hospitalizations, deaths }], i) => {

      const uninterpolatedData = zip(date, peopleTested, totalTests, positives, hospitalizations, deaths)
        .map(([date, peopleTested, totalTests, positives, hospitalizations, deaths]) => (
            {population, date: new Date(date), peopleTested, totalTests, positives, hospitalizations, deaths}
        ));

      // make an array of pairs of previous and next datums:
      const prevoiusAndNextData = zip(
        [null, ...uninterpolatedData],
        [...uninterpolatedData, null],
      );
      prevoiusAndNextData.pop();
      prevoiusAndNextData.shift();

      // build an array of daily data, linear interpolating where necessary:
      const interpolatedData = prevoiusAndNextData.reduce(
        (data, [previousDatum, nextDatum]) => {
          // make a new list of data points, interpolated or not, for all days after the previous date and including the next date:
          const additionalData = [];
          let date = addDays(previousDatum.date, 1);

          while (date < nextDatum.date) {
            // determine weights for interpolation:
            const millisToPreviousDate = differenceInMilliseconds(previousDatum.date, date)
            const millisToNextDate = differenceInMilliseconds(date, nextDatum.date)
            const previousWeight = millisToNextDate / (millisToPreviousDate + millisToNextDate)
            const nextWeight = millisToPreviousDate / (millisToPreviousDate + millisToNextDate)

            // build the datum:
            const datum = {
              date,
              interpolated: true
            }
            interpolatedFields.forEach((fieldName) => {
              // The choice to round here is questionable:
              datum[fieldName] = Math.round(
                (previousDatum[fieldName] * previousWeight) + (nextDatum[fieldName] * nextWeight)
              )
            })

            additionalData.push(datum)

            date = addDays(date, 1);
          }

          additionalData.push({...nextDatum, interpolated: false})

          return [...data, ...additionalData]
        },
        // start with the first datum:
        [{...uninterpolatedData[0], interpolated: false}] // TODO make sure data isn't empty
      );

      // smooth with a trailing average (prefixed by μ):
      const smoothedInterpolatedData = interpolatedData.map((datum, i) => {
        const smoothingData = interpolatedData.slice(i + 1 - smoothingWindowInDays, i + 1)
        const smoothedFields = smoothingData.length === smoothingWindowInDays ? {
          μpeopleTested: mean(smoothingData, d => d.peopleTested),
          μtotalTests: mean(smoothingData, d => d.totalTests),
          μpositives: mean(smoothingData, d => d.positives),
          μhospitalizations: mean(smoothingData, d => d.hospitalizations),
          μdeaths: mean(smoothingData, d => d.deaths),
        } : {}

        return {...datum, ...smoothedFields}
      })

      // add derivatives for cumulative fields:
      const smoothedInterpolatedDataWithDerivatives = smoothedInterpolatedData.map((datum, i) => {
        const previousDatum = smoothedInterpolatedData[i - 1]
        const derivativeFields = previousDatum ? {
          ΔpeopleTested: datum.μpeopleTested - previousDatum.μpeopleTested,
          ΔtotalTests: datum.μtotalTests - previousDatum.μtotalTests,
          Δpositives: datum.μpositives - previousDatum.μpositives,
          Δhospitalizations: datum.μhospitalizations - previousDatum.μhospitalizations,
          Δdeaths: datum.μdeaths - previousDatum.μdeaths,
        } : {}

        return {
          ...datum,
          ...derivativeFields
        }
      })

      return ({
        hraId: hraId,
        name: hraName,
        active: hraId === '1000',
        timeSeries: smoothedInterpolatedDataWithDerivatives
      });
    })
    .value();

  return {
    hras: covidDataByHraId,
    hoveredHraId: undefined,
    unusedColors: [...schemeTableau10]
  }
}

export default function useCombinedState(covidData) {
  const defaultState = useMemo(() => buildDefaultState(covidData), [covidData])
  const [state, dispatch] = useReducer(reducer, defaultState);

  const setAllInactive = useCallback(() => dispatch({type: 'SET_ALL_INACTIVE'}))
  const toggleActive = useCallback((hraId) => dispatch({type: 'TOGGLE_ACTIVE', hraId}), [dispatch])
  const setHoveredHraId = useCallback((hraId) => dispatch({type: 'SET_HOVER', hraId}), [dispatch])

  return {state, toggleActive, setHoveredHraId, setAllInactive}
}
