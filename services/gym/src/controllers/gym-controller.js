import { gym } from '../models/gym.js';

export function getGym(_request, response) {
  response.json(gym);
}