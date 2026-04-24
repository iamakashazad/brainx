import * as Progress from "@radix-ui/react-progress";

type PersonaTabProgressProps = {
  completedCount: 0 | 1 | 2 | 3 | 4;
};

export function PersonaTabProgress({ completedCount }: PersonaTabProgressProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
        <span>Section progress</span>
        <span>{completedCount}/4 completed</span>
      </div>
      <Progress.Root
        className="grid grid-cols-4 gap-2"
        value={completedCount}
        max={4}
        aria-label="Persona section progress"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className={
              index < completedCount
                ? "h-2 rounded-full bg-primary"
                : "h-2 rounded-full bg-muted"
            }
          />
        ))}
      </Progress.Root>
    </div>
  );
}
