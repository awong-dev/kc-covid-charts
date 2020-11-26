import { useCallback } from 'react';
import { chain, sortBy } from 'lodash';
import {
  withScriptjs, withGoogleMap, GoogleMap, Marker, Polygon,
} from 'react-google-maps';
import mapStyle from '../data/mapStyle.json';
import geojson from '../data/HRA_2010Block_Clip_simplified_wgs84.json';

const polygonsCoordsByHRAId = chain(geojson.features)
  .keyBy(({ properties: { VID } }) => (VID))
  .mapValues(({ geometry: { type, coordinates } }) => (type === 'MultiPolygon' ? coordinates : [coordinates]))
  .value();

const MapFrame = withScriptjs(withGoogleMap(({ children }) => (
  <GoogleMap
    defaultZoom={8}
    defaultCenter={{ lat: 47.5480, lng: -121.9836 }}
    defaultOptions={{
      fullScreenControl: false,
      mapTypeControl: false,
      rotateControl: false,
      scaleControl: true,
      streetViewControl: false,
      styles: mapStyle,
    }}
  >
    {children}
  </GoogleMap>
)));

const HRAMultiPolygon = ({
  hraId, active, toggleActive, isHovered, setHoveredHraId
}) => {
  const handleMouseOver = useCallback(() => setHoveredHraId(hraId), [hraId, setHoveredHraId]);
  const handleMouseOut = useCallback(() => setHoveredHraId(null), [hraId, setHoveredHraId]);

  const toggle = useCallback(() => toggleActive(hraId), [hraId]);
  return (polygonsCoordsByHRAId[hraId].map((polygonCoordinates) => (
    <Polygon
      paths={polygonCoordinates.map((path) => path.map(([lng, lat]) => ({ lng, lat })))}
      options={{
        fillColor: 'black',
        fillOpacity: active ? 0.8 : 0.2,
        strokeWeight: isHovered ? 3 : 0.5,
        strokeColor: isHovered ? 'rgba(245, 158, 11, 1)' : 'black',
        zIndex: isHovered ? 2 : 1
      }}
      onClick={toggle}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
    />
  ))
  );
};

export default function Map({ state: { hras, hoveredHraId }, toggleActive, setHoveredHraId }) {
  return (
    <MapFrame
      isMarkerShown
      googleMapURL="https://maps.googleapis.com/maps/api/js?v=3.exp&libraries=geometry,drawing,places&key=AIzaSyC4gh8ONDFM1Wk6G8alPEE92Loyc7my7UY"
      loadingElement={<div style={{ height: '100%' }} />}
      containerElement={<div className="flex-grow" />}
      mapElement={<div style={{ height: '100%' }} />}
    >
      {Object.values(hras).map(({ hraId, active }) => (
        <HRAMultiPolygon
          key={hraId}
          hraId={hraId}
          active={active}
          toggleActive={toggleActive}
          isHovered={hoveredHraId === hraId}
          setHoveredHraId={setHoveredHraId}
        />
      ))}
    </MapFrame>
  );
}