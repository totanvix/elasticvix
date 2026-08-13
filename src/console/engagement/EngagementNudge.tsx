import { useSyncExternalStore } from 'react';
import { MessageSquare, Star, XIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { CWS_REVIEW_URL, GITHUB_URL, shouldShowNudge } from './engagementLib';
import {
  dismissEngagement,
  getEngagement,
  snoozeEngagement,
  subscribeEngagement,
} from './engagementStore';

export function EngagementNudge() {
  const state = useSyncExternalStore(subscribeEngagement, getEngagement);
  if (!shouldShowNudge(state)) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">Enjoying Elasticvix?</p>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-2 size-7"
          aria-label="Dismiss"
          onClick={dismissEngagement}
        >
          <XIcon />
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        You&apos;ve run {state.runs} queries. A star or a short review helps other Elasticsearch
        users find this extension.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Button asChild size="sm">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" onClick={snoozeEngagement}>
            <Star /> Star on GitHub
          </a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={CWS_REVIEW_URL} target="_blank" rel="noopener noreferrer" onClick={dismissEngagement}>
            <MessageSquare /> Rate it
          </a>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto text-muted-foreground"
          onClick={snoozeEngagement}
        >
          Later
        </Button>
      </div>
    </div>
  );
}
