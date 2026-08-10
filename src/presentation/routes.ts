import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("verify/:token", "routes/verify.tsx"),
  route("manage/:token", "routes/manage.tsx"),
  route("unsubscribe/:token", "routes/unsubscribe.tsx"),
  route(":capability", "routes/capabilities.tsx"),
  route("zh/:capability", "routes/zh-capabilities.tsx"),
] satisfies RouteConfig;
