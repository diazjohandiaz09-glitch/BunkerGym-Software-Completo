import { community } from '../models/community.js';

export function getCommunity(_request, response) {
  response.json(community);
}