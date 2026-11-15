import { faq } from '../models/faq.js';
export function getFaq(_request, response) { response.json(faq); }