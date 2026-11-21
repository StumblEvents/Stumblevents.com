function label(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validCents(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const cents = Number(value);
  return Number.isFinite(cents) && cents >= 0 ? Math.round(cents) : null;
}

// Mirrors App.tsx getEventPriceLabel / lib/eventTicketPricing.ts. Unknown data
// never becomes Free; is_paid is the creator's explicit pricing decision.
function eventPriceLabel(event) {
  if (event.is_paid === false) return 'Free';
  if (event.is_paid !== true) return '';
  const min = validCents(event.ticket_price_min_cents);
  const max = validCents(event.ticket_price_max_cents);
  const dollars = cents => `$${(cents / 100).toFixed(2)}`;
  if (min !== null && max !== null) {
    const high = Math.max(min, max);
    if (high === 0) return 'Free';
    if (min === 0) return `Free – ${dollars(high)}`;
    return min === high ? dollars(min) : `${dollars(min)} – ${dollars(high)}`;
  }
  if (event.ticket_sales_enabled === true) return 'Paid';
  if (event.price_varies === true) return 'Paid · varies';
  const legacy = String(event.ticket_price ?? '').trim();
  return legacy && Number.isFinite(Number(legacy)) && Number(legacy) > 0 ? `Paid · $${legacy}` : 'Paid';
}

// Persisted display_pills are selection keys, not user-facing strings.
// Match the native full Event popup's available/selected/default rules.
function eventPillLabels(event) {
  const available = [
    ...(event.recurrence === 'Every Week' ? [{ key: 'weekly', label: 'Weekly Event' }] : []),
    ...(event.recurrence === 'Every 2 Weeks' ? [{ key: 'biweekly', label: 'Every 2 Weeks' }] : []),
    ...((event.occurrences || []).filter(row => row?.status !== 'cancelled').length > 1 ? [{ key: 'showings', label: 'Multiple Showings' }] : []),
    ...(event.multi_day || event.recurrence === 'Multi-day' ? [{ key: 'multi_day', label: 'Multi-day Event' }] : []),
    { key: 'category', label: label(event.category_name) },
    { key: 'subcategory', label: label(event.subcategory_name) },
    { key: 'more', label: label(event.sub_subcategory_name) },
    { key: 'custom', label: label(event.custom_category_label).slice(0, 64) },
  ].filter(pill => pill.label);
  const selected = Array.isArray(event.display_pills) ? event.display_pills
    : available.filter(pill => !['weekly', 'custom'].includes(pill.key)).map(pill => pill.key);
  const values = [...available.filter(pill => selected.includes(pill.key)).map(pill => pill.label), eventPriceLabel(event)].filter(Boolean);
  return values.filter((value, index) => values.findIndex(other => other.toLocaleLowerCase() === value.toLocaleLowerCase()) === index);
}

module.exports = { eventPillLabels, eventPriceLabel };
