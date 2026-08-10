import type {
  ReminderSchedulerPort,
  ScheduleReminderRequest,
} from "../../../application/ports/reminder-scheduler";
import type { ReminderWorkflowMessage } from "./reminder-workflow-message";

export class CloudflareWorkflowScheduler implements ReminderSchedulerPort {
  constructor(private readonly workflow: Workflow<ReminderWorkflowMessage>) {}

  async schedule(request: ScheduleReminderRequest): Promise<void> {
    await this.workflow.create({
      id: `${request.reminderId}-v${String(request.expectedVersion)}`,
      params: request,
      retention: { successRetention: "7 days", errorRetention: "30 days" },
    });
  }
}
