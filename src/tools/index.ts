import { busLines } from "./busLines.js";
import { cityServicesSearch } from "./cityServicesSearch.js";
import { datasetFiles } from "./datasetFiles.js";
import { detranPrInfo } from "./detranPrInfo.js";
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
  busLines,
] as const;
