import SunCalc from '../assets/vendor/suncalc.js';

export const solarReference = Object.freeze({ latitude: 41.39, longitude: 2.17, timeZone: 'Europe/Madrid', label: 'Catalunya' });
const degrees = 180 / Math.PI;
const smooth = (low, high, value) => { const t = Math.min(1, Math.max(0, (value - low) / (high - low))); return t * t * (3 - 2 * t); };

export function solarLight(date, { windowAzimuth = 45 } = {}) {
  if (!(date instanceof Date) || !Number.isFinite(date.valueOf())) throw new TypeError('Data no vàlida.');
  // SunCalc 1.9 uses radians, azimuth measured from south towards west.
  const sun = SunCalc.getPosition(date, solarReference.latitude, solarReference.longitude);
  const altitude = sun.altitude * degrees;
  // Room orientation is independent of the geographical solar calculation.
  // Default keeps the archived south-west window; the desk corner faces south.
  const relative = sun.azimuth - windowAzimuth / degrees;
  const direction = [-Math.cos(sun.altitude) * Math.cos(relative), Math.sin(sun.altitude), Math.cos(sun.altitude) * Math.sin(relative)];
  const day = smooth(-8, 12, altitude);
  const artificial = 1 - smooth(0, 13, altitude);
  const golden = (1 - smooth(3, 24, altitude)) * smooth(-6, 1, altitude);
  const phase = altitude < -12 ? 'night' : altitude < 0 ? 'twilight' : 'day';
  return {
    altitude, azimuth: sun.azimuth * degrees, direction, day, artificial, golden, phase,
    label: phase === 'night' ? 'Nit' : phase === 'twilight' ? (sun.azimuth < 0 ? 'Albada' : 'Capvespre') : altitude < 12 ? 'Sol baix' : 'Llum de dia',
    sunIntensity: 2.8 * smooth(-.8, 5, altitude) * smooth(0, .25, -direction[0]),
  };
}

const referenceClock = new Intl.DateTimeFormat('en-GB', { timeZone: solarReference.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function referenceTime(date) {
  const parts = Object.fromEntries(referenceClock.formatToParts(date).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

// Resolve a wall-clock time in Catalonia, independently of the visitor's time zone.
// Reject nonexistent local times during the spring daylight-saving transition.
export function referenceDate(day, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, date] = day.split('-').map(Number), [hour, minute] = time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, date, hour, minute);
  let instant = wall;
  for (let i = 0; i < 3; i++) {
    const parts = referenceTime(new Date(instant));
    const formatted = Date.parse(parts.date + 'T' + parts.time + ':00Z');
    instant = wall - (formatted - instant);
  }
  const result = new Date(instant), check = referenceTime(result);
  return check.date === day && check.time === time ? result : null;
}
