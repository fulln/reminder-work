import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("auth/login", "routes/auth-login.tsx"),
  route("auth/start/:provider", "routes/auth-start.ts"),
  route("auth/callback", "routes/auth-callback.ts"),
  route("auth/logout", "routes/auth-logout.ts"),
  route("reminders", "routes/reminders.tsx"),
  route("reminders/:id", "routes/owned-reminder.tsx"),
  route("settings/email", "routes/email-settings.tsx"),
  route("verify-email/:token", "routes/verify-email-identity.tsx"),
  route("verify/:token", "routes/verify.tsx"),
  route("manage/:token", "routes/manage.tsx"),
  route("unsubscribe/:token", "routes/unsubscribe.tsx"),
  route("calendar.ics", "routes/calendar-export.ts"),
  route("calendar/:token", "routes/calendar-subscription.ts"),
  route("about", "routes/about.tsx"),
  route("privacy", "routes/privacy.tsx"),
  route("contact", "routes/contact.tsx"),
  route(":capability", "routes/capabilities.tsx"),
  route("zh/:capability", "routes/zh-capabilities.tsx"),
] satisfies RouteConfig;
