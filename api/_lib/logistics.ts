// Team Dashboard > Logistics > Inventory → the Logistics tab.
// Each row is an item: how many we have, how many are needed, who's holding
// it (`Location`) and the event it's for. Quantities are free text in Notion
// ("5 packs"). Any committee member may add, edit or delete an item.

import type { CreatePageParameters, PageObjectResponse } from '@notionhq/client';
import { HttpError } from './http.js';
import { cacheInvalidate, cached, dataSourceId, notion, queryAll, retrievePageIn } from './notion.js';
import { richText, select, title, write } from './props.js';

export interface InventoryItemDto {
  id: string;
  item: string;
  quantity: string | null;
  qtyNeeded: string | null;
  /** `Location` select: who or where it's kept. */
  location: string | null;
  /** `Event` select. */
  event: string | null;
  /** The Notion page. */
  url: string;
}

function toItem(page: PageObjectResponse): InventoryItemDto {
  return {
    id: page.id,
    item: title(page, 'Item') ?? '',
    quantity: richText(page, 'Quantity'),
    qtyNeeded: richText(page, 'Qty Needed'),
    location: select(page, 'Location'),
    event: select(page, 'Event'),
    url: page.url,
  };
}

/** Items with a name, oldest first like the Notion table. Blank rows are skipped. */
export async function loadInventory(): Promise<InventoryItemDto[]> {
  const pages = await cached('logistics:pages', () =>
    queryAll(dataSourceId('logistics'), { sorts: [{ timestamp: 'created_time', direction: 'ascending' }] }),
  );
  return pages.map(toItem).filter((i) => i.item.trim() !== '');
}

// ── Writes ───────────────────────────────────────────────────────────────────

export interface InventoryInput {
  item?: unknown;
  quantity?: unknown;
  qtyNeeded?: unknown;
  location?: unknown;
  event?: unknown;
}

function parseText(value: unknown, label: string, max: number): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > max) throw new HttpError(400, `${label} must be text of ${max} characters or fewer`);
  return value.trim() || null;
}

/** Notion properties for the fields present in input. Fields left out are untouched. */
function toProperties(input: InventoryInput, creating: boolean): NonNullable<CreatePageParameters['properties']> {
  const props: NonNullable<CreatePageParameters['properties']> = {};
  if (creating || 'item' in input) {
    const item = parseText(input.item, 'Item', 200);
    if (!item) throw new HttpError(400, 'Item is required');
    props.Item = write.title(item);
  }
  if ('quantity' in input) props.Quantity = write.richText(parseText(input.quantity, 'Quantity', 200));
  if ('qtyNeeded' in input) props['Qty Needed'] = write.richText(parseText(input.qtyNeeded, 'Qty needed', 200));
  // Commas aren't allowed in Notion select options; a new name adds an option.
  if ('location' in input) props.Location = write.select(parseText(input.location, 'Location', 100)?.replace(/,/g, ' ') ?? null);
  if ('event' in input) props.Event = write.select(parseText(input.event, 'Event', 100)?.replace(/,/g, ' ') ?? null);
  return props;
}

export async function createInventoryItem(input: InventoryInput): Promise<InventoryItemDto> {
  const page = await notion().pages.create({
    parent: { type: 'data_source_id', data_source_id: dataSourceId('logistics') },
    properties: toProperties(input, true),
  });
  cacheInvalidate('logistics:');
  if (!('properties' in page)) throw new HttpError(502, 'Notion did not return the new item');
  return toItem(page);
}

export async function updateInventoryItem(id: string, input: InventoryInput): Promise<InventoryItemDto> {
  if (!(await retrievePageIn('logistics', id))) throw new HttpError(404, 'Item not found');
  const properties = toProperties(input, false);
  if (Object.keys(properties).length === 0) throw new HttpError(400, 'Nothing to update');
  const page = await notion().pages.update({ page_id: id, properties });
  cacheInvalidate('logistics:');
  if (!('properties' in page)) throw new HttpError(502, 'Notion did not return the updated item');
  return toItem(page);
}

/** Move an item to Notion's trash (restorable there for 30 days). */
export async function deleteInventoryItem(id: string): Promise<void> {
  if (!(await retrievePageIn('logistics', id))) throw new HttpError(404, 'Item not found');
  await notion().pages.update({ page_id: id, in_trash: true });
  cacheInvalidate('logistics:');
}
