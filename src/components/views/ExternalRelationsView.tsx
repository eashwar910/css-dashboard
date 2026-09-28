import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Building2, ExternalLink, MessageCircle } from 'lucide-react';
import { useSponsors } from '@/hooks/useSponsors';

export function ExternalRelationsView() {
  const { data: sponsors, byCompany, isLoading, error } = useSponsors();

  return (
    <div className="space-y-10">
      <header className="border-b border-border pb-6">
        <h1 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl">External Relations</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Sponsors and their contacts, from the Marketing Team's Contacts page in Notion.
        </p>
      </header>

      <section>
        <div className="mb-4 flex items-baseline justify-between border-b border-border pb-2">
          <h2 className="font-serif text-lg font-semibold">Sponsors</h2>
          <span className="text-xs text-muted-foreground">
            {isLoading
              ? 'Loading...'
              : `${byCompany.length} ${byCompany.length === 1 ? 'company' : 'companies'} · ${sponsors.length} ${sponsors.length === 1 ? 'contact' : 'contacts'}`}
          </span>
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3 border border-border p-5">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3.5 w-2/3" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 py-6 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Couldn't load sponsors — try refreshing.</span>
          </div>
        ) : byCompany.length === 0 ? (
          <p className="py-6 text-xs text-muted-foreground">
            No sponsors yet. Tag a contact with the "Sponsor" category in Notion to list it here.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {byCompany.map((company) => (
              <article key={company.name} className="border border-border p-5">
                <h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
                  <Building2 className="h-4 w-4 shrink-0 text-primary" />
                  {company.name}
                </h3>
                <ul className="mt-3 divide-y divide-border">
                  {company.contacts.map((contact) => (
                    <li key={contact.id} className="py-3">
                      <p className="text-sm font-medium text-foreground">{contact.name}</p>
                      {contact.jobTitle && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{contact.jobTitle}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                        {contact.contactMethod && (
                          <span className="flex items-center gap-1.5">
                            <MessageCircle className="h-3 w-3 shrink-0" />
                            {contact.contactMethod}
                          </span>
                        )}
                        {contact.linkedIn && (
                          <a
                            href={contact.linkedIn}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 transition-colors hover:text-primary"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            LinkedIn
                          </a>
                        )}
                      </div>
                      {contact.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {contact.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              style={{ borderRadius: 0 }}
                              className="text-[10px] font-normal uppercase tracking-wider"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
