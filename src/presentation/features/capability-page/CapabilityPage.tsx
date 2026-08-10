import type { ComposerActionData } from "../reminder-composer/ReminderComposer";
import { ReminderComposer } from "../reminder-composer/ReminderComposer";
import type {
  CapabilityLocale,
  CapabilityPreset,
} from "../../../content/capability-presets";
import { TimeRail } from "../../ui/TimeRail";
import { SiteHeader } from "../../ui/SiteHeader";
import styles from "./CapabilityPage.module.css";

export function CapabilityPage({
  preset,
  locale,
  actionData,
}: {
  readonly preset: CapabilityPreset;
  readonly locale: CapabilityLocale;
  readonly actionData?: ComposerActionData;
}) {
  const content = preset.content[locale];
  const peerHref = locale === "en" ? `/zh/${preset.slug}` : `/${preset.slug}`;
  return (
    <main id="main-content" className="landing-shell">
      <SiteHeader
        locale={locale}
        utilityLink={{
          href: peerHref,
          label: locale === "en" ? "中文" : "English",
          hrefLang: locale === "en" ? "zh-CN" : "en",
        }}
      />
      <section className="hero" aria-labelledby="capability-title">
        <div className="hero-copy">
          <p className="eyebrow">{content.eyebrow}</p>
          <h1 id="capability-title">{content.heading}</h1>
          <p className="hero-lede">{content.lede}</p>
          <p className={styles.example}>{content.example}</p>
          <a className={styles.languageLink} href="#reminder-composer">
            {locale === "en" ? "Create this reminder" : "创建这个提醒"}
          </a>
        </div>
        <div className="instrument" id="reminder-composer">
          <div className="instrument-head">
            <span>{locale === "en" ? "New reminder" : "新提醒"}</span>
            <span className="status-dot">
              {actionData?.stage === "review" ? "Review" : "Draft"}
            </span>
          </div>
          <TimeRail
            activeStep={
              actionData?.stage === "review" ? "scheduled" : "defined"
            }
          />
          <div className="composer-slot">
            <ReminderComposer actionData={actionData} preset={preset} />
          </div>
        </div>
      </section>
    </main>
  );
}
