import { MessageSquare, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { CWS_REVIEW_URL, GITHUB_URL } from '../engagement/engagementLib';
import { RELEASES } from './releases';

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  version: string;
};

// Append a time so the date is parsed as local, not UTC — otherwise a negative
// offset shifts every release back a day.
function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function WhatsNewDialog({ isOpen, onOpenChange, version }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What&apos;s new</DialogTitle>
          <DialogDescription>You&apos;re on v{version}.</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          {RELEASES.map((release) => (
            <section key={release.version}>
              <h3 className="text-sm font-medium">
                v{release.version}
                <span className="ml-2 font-normal text-muted-foreground">{formatDate(release.date)}</span>
              </h3>
              <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
                {release.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <section className="flex flex-col gap-2 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Elasticvix is free and open source. A rating helps other Elasticsearch users find it.
          </p>
          <div className="flex gap-2">
            <Button asChild size="sm">
              <a href={CWS_REVIEW_URL} target="_blank" rel="noopener noreferrer">
                <MessageSquare /> Rate on Chrome Web Store
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                <Star /> Star on GitHub
              </a>
            </Button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
