import { Button } from './ui/button';

export function App() {
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Elasticvix</h1>
      <p className="text-muted-foreground">shadcn/ui + Tailwind v4 + Be Vietnam Pro</p>
      <div className="flex gap-2">
        <Button>Primary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
      </div>
    </div>
  );
}
