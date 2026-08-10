export interface TimeRailProps {
  readonly activeStep?: "defined" | "scheduled" | "completed";
}

export function TimeRail({ activeStep = "defined" }: TimeRailProps) {
  return (
    <ol className="time-rail" aria-label="Reminder progress">
      <li aria-current={activeStep === "defined" ? "step" : undefined}>
        <span className="rail-node is-active" aria-hidden="true" />
        <span className="visually-hidden">Defined</span>
      </li>
      <li className="rail-line" aria-hidden="true" />
      <li aria-current={activeStep === "completed" ? "step" : undefined}>
        <span className="rail-node" aria-hidden="true" />
        <span className="visually-hidden">Acknowledged</span>
      </li>
    </ol>
  );
}
