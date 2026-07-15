import type { ReactNode } from 'react';

type ShellProps = {
  topBar: ReactNode;
  children: ReactNode;
};

export function AppShell({ topBar, children }: ShellProps) {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b px-4 py-2">{topBar}</header>
      <div className="flex min-h-0 flex-1">{children}</div>
    </div>
  );
}

type PanesProps = {
  leftRail: ReactNode;
  editor: ReactNode;
  response: ReactNode;
};

export function RestPanes({ leftRail, editor, response }: PanesProps) {
  return (
    <>
      <aside className="w-64 shrink-0 overflow-y-auto border-r">{leftRail}</aside>
      <main className="grid min-w-0 flex-1 grid-cols-2">
        <section className="min-w-0 overflow-hidden border-r">{editor}</section>
        <section className="min-w-0 overflow-auto">{response}</section>
      </main>
    </>
  );
}
