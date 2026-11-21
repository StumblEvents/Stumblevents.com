import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { eventPillLabels, eventPriceLabel } = require('../api/_event-pills.js');
const { renderEventPreview } = require('../api/_event-preview.js');

test('selected custom category and explicit free status match the native full event popup', () => {
  const event = { category_name: 'Party', subcategory_name: 'Other', custom_category_label: 'Baby Shower', display_pills: ['custom'], is_paid: false };
  assert.deepEqual(eventPillLabels(event), ['Baby Shower', 'Free']);
  const html = renderEventPreview({ preview: { ...event, id: 'any-event', title: 'An event', occurrences: [] }, canonicalUrl: 'https://preview.example/events/any-event' });
  const pills = [...html.matchAll(/<span class="chip">([^<]*)<\/span>/g)].map(match => match[1]);
  assert.deepEqual(pills, ['Baby Shower', 'Free']);
});

test('display keys map to stored labels, preserve custom casing, and do not expose unknown keys', () => {
  const event = { category_name: 'Music', subcategory_name: 'Jazz', sub_subcategory_name: 'Live', custom_category_label: '  iOS & eSports  ', is_paid: true };
  assert.deepEqual(eventPillLabels({ ...event, display_pills: ['custom', 'custom', 'unknown'] }), ['iOS & eSports', 'Paid']);
  assert.deepEqual(eventPillLabels({ ...event, display_pills: ['subcategory', 'more'] }), ['Jazz', 'Live', 'Paid']);
  assert.deepEqual(eventPillLabels({ ...event, display_pills: null }), ['Music', 'Jazz', 'Live', 'Paid']);
  assert.deepEqual(eventPillLabels({ ...event, display_pills: [] }), ['Paid']);
});

test('missing custom RPC data never falls back to raw Party, Other, or custom', () => {
  assert.deepEqual(eventPillLabels({ category_name: 'Party', subcategory_name: 'Other', display_pills: ['custom'], is_paid: false }), ['Free']);
  assert.deepEqual(eventPillLabels({ display_pills: ['custom'] }), []);
});

test('free and paid labels honor explicit pricing, catalog summaries, and legacy paid rules', () => {
  const cases = [
    [{}, ''], [{ is_paid: null, ticket_types: [] }, ''],
    [{ is_paid: false, ticket_price_min_cents: 2000 }, 'Free'],
    [{ is_paid: true, ticket_types: [] }, 'Paid'],
    [{ is_paid: true, ticket_sales_enabled: true, ticket_price_min_cents: null, ticket_price_max_cents: null }, 'Paid'],
    [{ is_paid: true, ticket_price_min_cents: 0, ticket_price_max_cents: 0 }, 'Free'],
    [{ is_paid: true, ticket_price_min_cents: 0, ticket_price_max_cents: 3500 }, 'Free – $35.00'],
    [{ is_paid: true, ticket_price_min_cents: 1200, ticket_price_max_cents: 1200 }, '$12.00'],
    [{ is_paid: true, ticket_price_min_cents: 1000, ticket_price_max_cents: 2500 }, '$10.00 – $25.00'],
    [{ is_paid: true, ticket_price: '12.50' }, 'Paid · $12.50'],
    [{ is_paid: true, ticket_price: '12.50', ticket_sales_enabled: true }, 'Paid'],
    [{ is_paid: true, ticket_price: '12.50', price_varies: true }, 'Paid · varies'],
    [{ is_paid: true, ticket_price: 0 }, 'Paid'],
  ];
  for (const [event, expected] of cases) assert.equal(eventPriceLabel(event), expected);
});

test('recurrence pills honor selected keys while multiple-showing selection stays independent', () => {
  const event = { recurrence: 'Every Week', occurrences: [{ id: 'first' }, { id: 'second' }], is_paid: false };
  assert.deepEqual(eventPillLabels(event), ['Multiple Showings', 'Free']);
  assert.deepEqual(eventPillLabels({ ...event, display_pills: ['weekly'] }), ['Weekly Event', 'Free']);
  assert.deepEqual(eventPillLabels({ ...event, recurrence: 'Every 2 Weeks', display_pills: null }), ['Every 2 Weeks', 'Multiple Showings', 'Free']);
});
