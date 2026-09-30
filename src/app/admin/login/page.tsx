import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/login-form";
import styles from "@/components/admin/admin.module.css";
import { isAdminConfigured } from "@/lib/auth";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Sign in" };

// Signed-in visitors are sent to /admin by src/proxy.ts before this renders.
export default function LoginPage() {
  return (
    <main className={styles.loginPage}>
      <div className={styles.loginCard}>
        <p className={styles.wordmark}>
          {site.name}
          <span className={styles.wordmarkTag}>Admin</span>
        </p>
        <div>
          <h1 className={styles.loginTitle}>Sign in</h1>
          <p className={styles.hint}>Sign in to manage photos and stories.</p>
        </div>
        {!isAdminConfigured() && (
          <p className={styles.alert}>
            Login is disabled until <code>ADMIN_USERNAME</code>, <code>ADMIN_PASSWORD</code> and{" "}
            <code>AUTH_SECRET</code> (32+ characters) are set.
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
