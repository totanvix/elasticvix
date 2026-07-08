import type { ReactNode } from 'react';

type Props = {
  topBar: ReactNode;
  leftRail: ReactNode;
  editor: ReactNode;
  response: ReactNode;
};

export function ConsoleLayout({ topBar, leftRail, editor, response }: Props) {
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b px-4 py-2">{topBar}</header>
      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 overflow-y-auto border-r">{leftRail}</aside>
        <main className="grid min-w-0 flex-1 grid-cols-2">
          <section className="min-w-0 overflow-hidden border-r">{editor}</section>
          <section className="min-w-0 overflow-auto">{response}</section>
        </main>
      </div>
    </div>
  );
}
