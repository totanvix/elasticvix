import { useState } from 'react';
import { CircleHelp, DatabaseBackup, Moon, Settings, Sparkles, Sun } from 'lucide-react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useTheme } from '../theme';
import { SettingsDialog } from './SettingsDialog';

const WEBSITE_URL = 'https://totanvix.github.io/elasticvix/';

const ITEM_CLASS = 'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent';

type Props = {
  onWhatsNew: () => void;
  hasUnseenRelease: boolean;
};

export function SettingsMenu({ onWhatsNew, hasUnseenRelease }: Props) {
  const { theme, toggle } = useTheme();
  const [isOpen, setOpen] = useState(false);
  const [isBackupOpen, setBackupOpen] = useState(false);

  return (
    <>
      <Popover open={isOpen} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            // Accent, never destructive red: red means a failure elsewhere in the app.
            className={hasUnseenRelease ? 'text-primary hover:text-primary' : undefined}
            aria-label={hasUnseenRelease ? 'Settings — new release available' : 'Settings'}
            title={hasUnseenRelease ? 'Settings — new release available' : 'Settings'}
          >
            <Settings />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1">
          <button
            type="button"
            className={ITEM_CLASS}
            onClick={() => {
              setOpen(false);
              setBackupOpen(true);
            }}
          >
            <DatabaseBackup className="h-4 w-4" /> Backup &amp; restore
          </button>
          {/* Stays open so the colour change is visible and reversible in one place. */}
          <button type="button" className={ITEM_CLASS} onClick={toggle}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            type="button"
            className={ITEM_CLASS}
            aria-label={hasUnseenRelease ? "What's new — new release available" : undefined}
            onClick={() => {
              setOpen(false);
              onWhatsNew();
            }}
          >
            <Sparkles className="h-4 w-4" /> What&apos;s new
            {hasUnseenRelease && (
              <span
                aria-hidden="true"
                className="ml-auto shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-primary"
              >
                New
              </span>
            )}
          </button>
          <a
            href={WEBSITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={ITEM_CLASS}
            onClick={() => setOpen(false)}
          >
            <CircleHelp className="h-4 w-4" /> Website — guides &amp; FAQ
          </a>
        </PopoverContent>
      </Popover>
      {isBackupOpen && (
        <SettingsDialog
          isOpen
          onOpenChange={(open) => {
            if (!open) setBackupOpen(false);
          }}
        />
      )}
    </>
  );
}
