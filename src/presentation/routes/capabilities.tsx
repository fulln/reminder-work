import { findCapabilityPreset } from "../../content/capability-presets";
import type { CapabilityLocale } from "../../content/capability-presets";
import { CapabilityPage } from "../features/capability-page/CapabilityPage";
import { applicationServicesContext } from "../server-context";
import { handleComposerAction } from "./home";
import type { Route } from "./+types/capabilities";

export function loader({ params, request }: Route.LoaderArgs) {
  const preset = findCapabilityPreset(params.capability);
  if (preset === undefined) throw new Error("CAPABILITY_NOT_FOUND");
  const locale: CapabilityLocale = new URL(request.url).pathname.startsWith(
    "/zh/",
  )
    ? "zh-CN"
    : "en";
  return { preset, locale };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  if (findCapabilityPreset(params.capability) === undefined)
    throw new Error("CAPABILITY_NOT_FOUND");
  return handleComposerAction(
    await request.formData(),
    context.get(applicationServicesContext),
  );
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  const { preset, locale } = loaderData;
  const content = preset.content[locale];
  const canonicalPath =
    locale === "en" ? `/${preset.slug}` : `/zh/${preset.slug}`;
  return [
    { title: content.title },
    { name: "description", content: content.description },
    {
      tagName: "link",
      rel: "canonical",
      href: `https://reminder.work${canonicalPath}`,
    },
    {
      tagName: "link",
      rel: "alternate",
      hrefLang: "en",
      href: `https://reminder.work/${preset.slug}`,
    },
    {
      tagName: "link",
      rel: "alternate",
      hrefLang: "zh-CN",
      href: `https://reminder.work/zh/${preset.slug}`,
    },
    {
      tagName: "link",
      rel: "alternate",
      hrefLang: "x-default",
      href: `https://reminder.work/${preset.slug}`,
    },
  ];
};

export default function CapabilityRoute({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  return (
    <CapabilityPage
      preset={loaderData.preset}
      locale={loaderData.locale}
      actionData={actionData ?? undefined}
    />
  );
}
