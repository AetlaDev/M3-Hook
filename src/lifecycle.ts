const m3HookCleanupTasks = new Set<() => void>();

export function m3HookOnCleanup(task: () => void): void {
  m3HookCleanupTasks.add(task);
}

export function m3HookCleanup(): void {
  for (const task of [...m3HookCleanupTasks]) {
    m3HookCleanupTasks.delete(task);
    try {
      task();
    } catch {}
  }
}
