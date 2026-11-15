import { recovery } from '../models/recovery.js';

export function getRecovery(_request, response) {
  response.json(recovery);
}