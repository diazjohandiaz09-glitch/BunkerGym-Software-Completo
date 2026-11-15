import { plans } from '../models/plans.js';
export function getPlans(_request, response) { response.json(plans); }