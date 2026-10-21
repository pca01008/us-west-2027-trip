// Extract only presentation data; never include API configuration or account details.
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../../', import.meta.url);
const context = { window: {} };
vm.runInNewContext(await readFile(new URL('trip-config.js', root), 'utf8'), context);
const trip = context.window.TRIP_CONFIG;
const data = {
  days: trip.days.map(day => ({ date: day.date, subtitle: day.subtitle, events: day.events.map(event => ({
    time: event.time, zone: event.zone || 'PST', title: event.title,
    detail: event.detail.replace(/ · Confirmation \w+/, ''), warnings: event.warnings || [],
    map: event.map ? { name: event.map.name, url: event.map.url } : null,
    photos: (event.photos || []).filter(photo => !photo.className?.includes('map')).map(photo => ({src: '../../' + photo.src, alt: photo.alt}))
  })) })),
  prep: trip.prep.items.map(item => item.text)
};
const source = await readFile(new URL('index.html', root), 'utf8');
const icons = source.match(/const ICONS = (\{[\s\S]*?\n  \});/)[1];
await writeFile(new URL('data.js', import.meta.url), `// Local configuration snapshot for UI exploration, not the live shared itinerary.\nwindow.DEMO_TRIP = ${JSON.stringify(data, null, 2)};\n// Reused from the incumbent app's icon family.\nwindow.UI_ICONS = ${icons};\n`);
console.log('Prepared local presentation data and existing icons.');
