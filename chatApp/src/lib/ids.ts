export function clientMessageId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `cm_${Date.now().toString(36)}_${rand}`;
}
