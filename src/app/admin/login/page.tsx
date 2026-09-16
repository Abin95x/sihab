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
        <p className={styles.brand}>{site.name}</p>
        <h1 className={styles.loginTitle}>Admin sign in</h1>
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
