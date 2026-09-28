// Marketing Team > Contacts → sponsor contacts for External Relations.
// Only rows tagged "Sponsor" in Category are read. Events Involved is ignored
// (it points at an events database the integration can't see).

import type { PageObjectResponse } from '@notionhq/client';
import { cached, dataSourceId, queryAll } from './notion.js';
import { multiSelect, phoneNumber, richText, title, url } from './props.js';

export interface SponsorContactDto {
  id: string;
  name: string;
  jobTitle: string | null;
  /** Usually one company; Notion stores it as a multi-select. */
  companies: string[];
  /** Other Category tags besides "Sponsor", e.g. "Crypto", "Industry Speaker". */
  tags: string[];
  /** Free text such as "tg: @handle" (a phone_number property in Notion). */
  contactMethod: string | null;
  linkedIn: string | null;
}

export function toSponsorContact(page: PageObjectResponse): SponsorContactDto {
  return {
    id: page.id,
    name: title(page, 'Name') ?? 'Unnamed contact',
    jobTitle: richText(page, 'Job Title'),
    companies: multiSelect(page, 'Company'),
    tags: multiSelect(page, 'Category').filter((c) => c !== 'Sponsor'),
    contactMethod: phoneNumber(page, 'Contact Method'),
    linkedIn: url(page, 'LinkedIn'),
  };
}

export async function loadSponsors(): Promise<SponsorContactDto[]> {
  const pages = await cached('contacts:sponsors', () =>
    queryAll(dataSourceId('contacts'), {
      filter: { property: 'Category', multi_select: { contains: 'Sponsor' } },
      sorts: [{ property: 'Name', direction: 'ascending' }],
    }),
  );
  return pages.map(toSponsorContact);
}
