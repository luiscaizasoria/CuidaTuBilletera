// Une la página nueva a la lista sin repetir ids (la paginación por desplazamiento puede repetir filas).
export function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...incoming.filter((item) => !seen.has(item.id))];
}
