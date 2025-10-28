import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: number;
  name: string;
  description: string;
}

interface ProgressStepperProps {
  steps: Step[];
  currentStep: number;
}

export function ProgressStepper({ steps, currentStep }: ProgressStepperProps) {
  return (
    <nav aria-label="Progress" className="mb-12">
      <ol role="list" className="flex items-center justify-between">
        {steps.map((step, stepIdx) => (
          <li
            key={step.id}
            className={cn(
              stepIdx !== steps.length - 1 ? "flex-1" : "",
              "relative"
            )}
          >
            {step.id < currentStep ? (
              <>
                <div className="absolute left-0 top-5 -ml-px h-0.5 w-full bg-primary" aria-hidden="true" />
                <div className="group relative flex items-start">
                  <span className="flex h-10 items-center">
                    <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                      <Check className="h-5 w-5 text-primary-foreground" />
                    </span>
                  </span>
                  <span className="ml-4 flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-foreground">{step.name}</span>
                    <span className="text-xs text-muted-foreground">{step.description}</span>
                  </span>
                </div>
              </>
            ) : step.id === currentStep ? (
              <>
                {stepIdx !== steps.length - 1 && (
                  <div className="absolute left-0 top-5 -ml-px h-0.5 w-full bg-border" aria-hidden="true" />
                )}
                <div className="group relative flex items-start" aria-current="step">
                  <span className="flex h-10 items-center" aria-hidden="true">
                    <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary bg-background">
                      <span className="h-3 w-3 rounded-full bg-primary" />
                    </span>
                  </span>
                  <span className="ml-4 flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-primary">{step.name}</span>
                    <span className="text-xs text-muted-foreground">{step.description}</span>
                  </span>
                </div>
              </>
            ) : (
              <>
                {stepIdx !== steps.length - 1 && (
                  <div className="absolute left-0 top-5 -ml-px h-0.5 w-full bg-border" aria-hidden="true" />
                )}
                <div className="group relative flex items-start">
                  <span className="flex h-10 items-center" aria-hidden="true">
                    <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-background">
                      <span className="h-3 w-3 rounded-full bg-transparent" />
                    </span>
                  </span>
                  <span className="ml-4 flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-muted-foreground">{step.name}</span>
                    <span className="text-xs text-muted-foreground">{step.description}</span>
                  </span>
                </div>
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
