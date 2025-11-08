export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const randomSegment = () => Math.random().toString(36).slice(2, 10)
  const timestampSegment = Date.now().toString(36)
  return `${timestampSegment}-${randomSegment()}-${randomSegment()}`
}
