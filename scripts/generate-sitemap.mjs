import { writeFile } from "node:fs/promises";

const slugs = [
  "online-reminder",
  "email-reminder",
  "recurring-reminder",
  "meeting-reminder",
  "deadline-reminder",
  "follow-up-reminder",
];
const paths = [
  "/",
  "/about",
  "/privacy",
  "/contact",
  ...slugs.flatMap((slug) => [`/${slug}`, `/zh/${slug}`]),
];
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((path) => `  <url><loc>https://reminders.work${path}</loc></url>`).join("\n")}
</urlset>
`;

await writeFile(new URL("../public/sitemap.xml", import.meta.url), xml);
console.log(`sitemap: wrote ${paths.length} canonical URLs`);
