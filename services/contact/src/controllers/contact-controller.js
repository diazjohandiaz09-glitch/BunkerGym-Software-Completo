import { contact } from '../models/contact.js';

export function getContact(_request, response) {
  response.json(contact);
}