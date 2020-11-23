import { chain, map, zip } from 'lodash';
import { useCallback, useReducer, useMemo } from 'react';

const reducer = (state, action) => {
  switch(action.type) {
    case 'TOGGLE_ACTIVE':
      return {...state, hras: {...state.hras, [action.hraId]: {...state.hras[action.hraId], active: !state.hras[action.hraId].active}}}
    case 'SET_HOVER':
      return {...state, hoveredHraId: action.hraId}
    break;
  }
}

const buildDefaultState = (covidData) => {
  const covidDataByHraId = chain(Object.entries(covidData.HRA))
    .filter(([_, {hraId}]) => !!hraId)
    .keyBy(([_, {hraId}]) => Number(hraId))
    .mapValues(([hraName, { hraId, population, date, peopleTested, allTestResults, positives, hospitalizations, deaths }], i) => ({
      hraId: hraId,
      name: hraName,
      active: hraName === 'Downtown', // TK
      timeSeries: zip(date, peopleTested, allTestResults, positives, hospitalizations, deaths)
        .map(([date, peopleTested, allTestResults, positives, hospitalizations, deaths]) => (
          {population, date, peopleTested, allTestResults, positives, hospitalizations, deaths}
      ))
    }))
    .value()

  return {
    hras: covidDataByHraId,
    hoveredHraId: 1000,
  }
}

export default function useCombinedState(covidData) {
  const defaultState = useMemo(() => buildDefaultState(covidData), [covidData])
  const [state, dispatch] = useReducer(reducer, defaultState);
  const toggleActive = useCallback((hraId) => dispatch({type: 'TOGGLE_ACTIVE', hraId}), [dispatch])
  const setHoveredHraId = useCallback((hraId) => dispatch({type: 'SET_HOVER', hraId}), [dispatch])
  return {state, toggleActive, setHoveredHraId}
}
