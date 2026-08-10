export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { startAutoBackupScheduler } = await import("./lib/auto-backup");
  startAutoBackupScheduler();
}
