import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("auth/login", "routes/auth-login.tsx"),
  route("auth/start/:provider", "routes/auth-start.ts"),
  route("auth/callback", "routes/auth-callback.ts"),
  route("auth/logout", "routes/auth-logout.ts"),
  route("verify/:token", "routes/verify.tsx"),
  route("manage/:token", "routes/manage.tsx"),
  route("unsubscribe/:token", "routes/unsubscribe.tsx"),
  route(":capability", "routes/capabilities.tsx"),
  route("zh/:capability", "routes/zh-capabilities.tsx"),
] satisfies RouteConfig;
