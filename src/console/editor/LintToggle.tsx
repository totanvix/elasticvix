import { SpellCheck } from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../lib/utils';

type Props = {
  enabled: boolean;
  onToggle: () => void;
  className?: string;
};

export function LintToggle({ enabled, onToggle, className }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant={enabled ? 'secondary' : 'ghost'}
          onClick={onToggle}
          aria-pressed={enabled}
          aria-label="Toggle field linting"
          className={cn('w-8 px-0', className)}
        >
          <SpellCheck className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{enabled ? 'Field linting on' : 'Field linting off'}</TooltipContent>
    </Tooltip>
  );
}
