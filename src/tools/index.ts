import { datasetFiles } from "./datasetFiles.js";
import { detranPrInfo } from "./detranPrInfo.js";
import { healthUnitsSearch } from "./healthUnitsSearch.js";
import { localCsvSummary } from "./localCsvSummary.js";
import { openDatasetsSearch } from "./openDatasetsSearch.js";
import { procurementSearch } from "./procurementSearch.js";
import { weatherAlerts } from "./weatherAlerts.js";
import { weatherForecast } from "./weatherForecast.js";

export const tools = [openDatasetsSearch, datasetFiles, healthUnitsSearch, procurementSearch, localCsvSummary, detranPrInfo, weatherForecast, weatherAlerts] as const;
