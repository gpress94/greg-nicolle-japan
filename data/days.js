// The itinerary is encrypted in days.enc.json. unlock.js asks for the trip
// password and decrypts it before app.js renders anything.
import { unlock } from '../unlock.js';

const data = await unlock();
export const TRIP = data.TRIP;
export const DAYS = data.DAYS;
