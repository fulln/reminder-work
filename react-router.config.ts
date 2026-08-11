import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "src/presentation",
  buildDirectory: "build",
  ssr: true,
  allowedActionOrigins: ["reminders.work", "*.reminders.work", "localhost:*"],
} satisfies Config;
