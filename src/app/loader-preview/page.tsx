import { notFound } from "next/navigation";
import { Spin } from "antd";
import { BrandMark } from "@/components/common/brand-mark";
import { CompetitionLogo } from "@/components/common/competition-logo";
import styles from "./loader-preview.module.css";

export default function LoaderPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className={styles.preview}>
      <div className={styles.ambient} aria-hidden="true"><i /><i /><i /><span /></div>
      <div className={styles.content}>
        <header className={styles.header}>
          <BrandMark dark />
          <span className={styles.localTag}><i /> Local motion study</span>
        </header>
        <section className={styles.intro}>
          <span className={styles.eyebrow}>CompetitionOS / Identity system</span>
          <h1>Every fixture starts with a signal.</h1>
          <p>The crest stays in motion while CompetitionOS prepares the next screen. A quiet blue field and moving bracket paths give the loading state more depth without pulling focus from the task.</p>
        </section>
        <section className={styles.stage} aria-label="Loader previews">
          <div className={`${styles.loaderPanel} ${styles.loaderPanelPrimary}`}>
            <div className={styles.panelGrid} aria-hidden="true" />
            <div className={styles.signalLine} aria-hidden="true"><i /><i /><i /><i /></div>
            <div className={styles.loaderContent}>
              <Spin size="large" />
              <span className={styles.panelEyebrow}>Match centre</span>
              <h2>Workspace loading</h2>
              <p>Fixtures, standings, and the next round are coming into view.</p>
            </div>
            <div className={styles.progressTrack} aria-hidden="true"><i /></div>
          </div>
          <div className={styles.sideStack}>
            <article className={styles.markPanel}>
              <div className={styles.logoHalo} aria-hidden="true" />
              <CompetitionLogo size={88} />
              <span className={styles.panelEyebrow}>Tournament mark</span>
              <h2>CompetitionOS</h2>
              <p>Built around the route to the final.</p>
            </article>
            <article className={styles.compactPanel}>
              <div><Spin size="small" /></div>
              <span><b>Compact loader</b><small>For inline actions and short transitions</small></span>
            </article>
          </div>
        </section>
        <footer className={styles.footer}><span>Blue on blue. Motion with a purpose.</span><span>Reduced-motion settings are respected.</span></footer>
      </div>
    </main>
  );
}
