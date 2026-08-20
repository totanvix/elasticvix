import { MessageSquare, Star, XIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { CWS_REVIEW_URL, GITHUB_URL } from '../engagement/engagementLib';
import { previewChanges } from './changelogLib';
import { RELEASES } from './releases';

type Props = {
  version: string;
  onSeeWhatsNew: () => void;
  onDismiss: () => void;
};

const MAX_BULLETS = 3;

export function UpdateToast({ version, onSeeWhatsNew, onDismiss }: Props) {
  // The manifest may be bumped before its changelog entry lands — then we still
  // announce the update, just without bullets.
  const release = RELEASES.find((r) => r.version === version);
  const preview = release ? previewChanges(release.changes, MAX_BULLETS) : undefined;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-primary">Elasticvix updated to v{version}</p>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-2 size-7"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <XIcon />
        </Button>
      </div>
      {preview && (
        <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
          {preview.shown.map((change) => (
            <li key={change}>
              <span className="line-clamp-2">{change}</span>
            </li>
          ))}
          {preview.remaining > 0 && (
            <li className="list-none pl-0 italic">+{preview.remaining} more</li>
          )}
        </ul>
      )}
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={onSeeWhatsNew}>
          See what&apos;s new
        </Button>
        <Button asChild size="sm" variant="outline" aria-label="Rate on Chrome Web Store">
          <a href={CWS_REVIEW_URL} target="_blank" rel="noopener noreferrer">
            <MessageSquare />
          </a>
        </Button>
        <Button asChild size="sm" variant="outline" aria-label="Star on GitHub">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <Star />
          </a>
        </Button>
      </div>
    </div>
  );
}
