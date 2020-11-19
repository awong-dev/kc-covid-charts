import {
  withScriptjs, withGoogleMap, GoogleMap, Marker, Polygon,
} from 'react-google-maps';
import {
  chain, keyBy, mapValues, value,
} from 'lodash';
import geojson from '../data/HRA_2010Block_Clip_simplified_wgs84.json';
import mapStyle from '../data/mapStyle.json';

// Construct a map from geography name to an array of polygons (AKA a
// multipolygon in geojson terminology):
const hraMultiPolygons = chain(geojson.features)
  .keyBy(({ properties: { HRA2010v2_: hra } }) => (hra))
  .mapValues(({ geometry: { type, coordinates } }) => (
    type === 'MultiPolygon' ? coordinates : [coordinates]
  ))
  .value();

const HRAMap = withScriptjs(withGoogleMap((props) => (
  <GoogleMap
    defaultZoom={9}
    defaultCenter={{ lat: 47.5480, lng: -121.9836 }}
    defaultOptions={{
      styles: mapStyle,
    }}
  >
    {Object.entries(hraMultiPolygons).map(([hra, multiPolygon]) => (
      multiPolygon.map((polygon) => (
        <Polygon
          paths={polygon.map((path) => path.map(([lng, lat]) => ({ lng, lat })))}
          options={{fillColor: 'red', strokeWeight: 1}}
        />
      ))
    ))}
  </GoogleMap>
)));

export default function Map() {
  return (
    <>
      <h1>HRAs!</h1>
      <HRAMap
        isMarkerShown
        googleMapURL="https://maps.googleapis.com/maps/api/js?v=3.exp&libraries=geometry,drawing,places&key=AIzaSyC4gh8ONDFM1Wk6G8alPEE92Loyc7my7UY"
        loadingElement={<div style={{ height: '100%' }} />}
        containerElement={<div style={{ height: '400px' }} />}
        mapElement={<div style={{ height: '100%' }} />}
      />
    </>
  );
}
