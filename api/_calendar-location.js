function clean(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').replace(/^\s*,\s*|\s*,\s*$/g, '').trim() : '';
}

function comparable(value) {
  return clean(value).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function contains(parts, value) {
  const needle = comparable(value);
  return !!needle && ` ${comparable(parts.join(', '))} `.includes(` ${needle} `);
}

// Calendar providers share this formatter. Never infer a country from a ZIP or
// discard the complete address in favor of less-complete structured fields.
function calendarLocation(preview) {
  const parts = clean(preview.address).split(',').map(clean).filter(Boolean);
  const city = clean(preview.city);
  const state = clean(preview.state);
  const zip = clean(preview.zip);
  const country = clean(preview.country);
  const unique = parts.filter((part, index) => parts.findIndex(other => comparable(other) === comparable(part)) === index);
  // When supplied separately, keep the country after newly completed locality fields.
  if (country) {
    const index = unique.findIndex(part => comparable(part) === comparable(country));
    if (index >= 0) unique.splice(index, 1);
  }
  const missingCity = city && !contains(unique, city) ? city : '';
  if (missingCity) unique.push(missingCity);
  const missingState = state && !contains(unique, state) ? state : '';
  const missingZip = zip && !contains(unique, zip) ? zip : '';
  if (missingState) unique.push([missingState, missingZip].filter(Boolean).join(' '));
  else if (missingZip) {
    // Keep the conventional state/ZIP grouping when the state already ends the address.
    const last = unique.length - 1;
    if (last >= 0 && comparable(unique[last]) === comparable(state)) unique[last] += ` ${missingZip}`;
    else unique.push(missingZip);
  }
  if (country && !contains(unique, country)) unique.push(country);
  const venue = clean(preview.venue_name);
  if (venue && !unique.some(part => comparable(part) === comparable(venue))) unique.unshift(venue);
  return unique.join(', ');
}

module.exports = { calendarLocation };
