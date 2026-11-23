import { busDepartures } from "./busDepartures.js";
import { busLineStops } from "./busLineStops.js";
import { busLinesSearch } from "./busLinesSearch.js";
import { busStopsNear } from "./busStopsNear.js";
import { cityFacilitiesSearch } from "./cityFacilitiesSearch.js";
import { cityPointsSearch } from "./cityPointsSearch.js";
import { cityServicesSearch } from "./cityServicesSearch.js";
import { datasetFiles } from "./datasetFiles.js";
import { detranPrInfo } from "./detranPrInfo.js";
import { eventsSearch } from "./eventsSearch.js";
import { guairaEvents } from "./guairaEvents.js";
import { healthUnitsSearch } from "./healthUnitsSearch.js";
import { localCsvSummary } from "./localCsvSummary.js";
import { nextBusesNear } from "./nextBusesNear.js";
import { openDatasetsSearch } from "./openDatasetsSearch.js";
import { placeAtPoint } from "./placeAtPoint.js";
import { placesSearch } from "./placesSearch.js";
import { procurementSearch } from "./procurementSearch.js";
import { riverLevels } from "./riverLevels.js";
import { taxReformCuritiba } from "./taxReformCuritiba.js";
import { usefulPhones } from "./usefulPhones.js";
import { vaccinationSitesSearch } from "./vaccinationSitesSearch.js";
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
  nextBusesNear,
  cityPointsSearch,
  eventsSearch,
  vaccinationSitesSearch,
  usefulPhones,
  cityFacilitiesSearch,
  riverLevels,
  guairaEvents,
  taxReformCuritiba,
  placeAtPoint,
] as const;
