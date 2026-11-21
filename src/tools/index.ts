import { busDepartures } from "./busDepartures.js";
import { busLineStops } from "./busLineStops.js";
import { busLinesSearch } from "./busLinesSearch.js";
import { busStopsNear } from "./busStopsNear.js";
import { cityPointsSearch } from "./cityPointsSearch.js";
import { cityServicesSearch } from "./cityServicesSearch.js";
import { datasetFiles } from "./datasetFiles.js";
import { detranPrInfo } from "./detranPrInfo.js";
import { eventsSearch } from "./eventsSearch.js";
import { healthUnitsSearch } from "./healthUnitsSearch.js";
import { localCsvSummary } from "./localCsvSummary.js";
import { openDatasetsSearch } from "./openDatasetsSearch.js";
import { placesSearch } from "./placesSearch.js";
import { procurementSearch } from "./procurementSearch.js";
import { weatherAlerts } from "./weatherAlerts.js";
import { weatherForecast } from "./weatherForecast.js";

export const tools = [
  openDatasetsSearch,
  datasetFiles,
  healthUnitsSearch,
  procurementSearch,
  localCsvSummary,
  detranPrInfo,
  weatherForecast,
  weatherAlerts,
  cityServicesSearch,
  placesSearch,
  busLinesSearch,
  busLineStops,
  busDepartures,
  busStopsNear,
  cityPointsSearch,
  eventsSearch,
] as const;
