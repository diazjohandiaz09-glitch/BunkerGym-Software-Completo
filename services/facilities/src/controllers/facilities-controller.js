import { facilities } from '../models/facilities.js';
export function getFacilities(_request, response) { response.json(facilities); }