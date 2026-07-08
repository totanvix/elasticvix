import { Button } from './ui/button';

export function App() {
  const toggleDark = () => document.documentElement.classList.toggle('dark');
  return (
    <div className="min-h-screen space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Elasticvix</h1>
        <Button variant="outline" size="sm" onClick={toggleDark}>
          Toggle theme
        </Button>
      </div>
      <p className="text-muted-foreground">shadcn/ui + Tailwind v4 + Be Vietnam Pro</p>
      <div className="flex gap-2">
        <Button>Primary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
      </div>
    </div>
  );
}
