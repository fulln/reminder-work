import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "src/presentation",
  buildDirectory: "build",
  ssr: true,
  allowedActionOrigins: ["reminder.work", "*.reminder.work", "localhost:*"],
} satisfies Config;
