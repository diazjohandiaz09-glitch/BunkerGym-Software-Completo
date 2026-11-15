import { training } from '../models/training.js';

export function getTraining(_request, response) {
  response.json(training);
}