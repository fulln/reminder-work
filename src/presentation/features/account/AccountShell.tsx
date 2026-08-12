import type { ReactNode } from "react";

import { SiteHeader } from "../../ui/SiteHeader";
import styles from "./AccountWorkspace.module.css";

export function AccountShell({ children }: { readonly children: ReactNode }) {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main id="main-content" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
