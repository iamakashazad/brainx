type QueueBadgeProps = {
  position: number | null;
};

export function QueueBadge({ position }: QueueBadgeProps) {
  if (position === null || position <= 0) {
    return null;
  }

  return (
    <span className="font-mono text-sm text-muted-foreground">
      Position {position} in queue
    </span>
  );
}
