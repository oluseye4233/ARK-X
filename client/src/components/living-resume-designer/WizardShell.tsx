import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

export interface WizardStep {
  key: string;
  label: string;
  content: React.ReactNode;
}

interface Props {
  steps: WizardStep[];
  active: string;
  onChange: (key: string) => void;
}

export function WizardShell({ steps, active, onChange }: Props) {
  const activeIndex = Math.max(0, steps.findIndex((s) => s.key === active));
  const progressPct = ((activeIndex + 1) / steps.length) * 100;

  return (
    <div className="space-y-4" data-testid="wizard-shell">
      <Progress value={progressPct} className="h-1.5" />
      <Tabs value={active} onValueChange={onChange}>
        <TabsList className="flex-wrap h-auto">
          {steps.map((s) => (
            <TabsTrigger key={s.key} value={s.key} data-testid={`tab-${s.key}`}>
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {steps.map((s) => (
          <TabsContent key={s.key} value={s.key} className="mt-4">
            {s.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
