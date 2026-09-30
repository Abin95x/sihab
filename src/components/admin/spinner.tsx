import styles from "./admin.module.css";

/** Small rotating ring shown inside buttons and links while an action runs. */
export function Spinner({ size = 12 }: { size?: number }) {
  return <span className={styles.spinner} style={{ width: size, height: size }} aria-hidden="true" />;
}
