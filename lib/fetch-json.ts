/** Read public JSON with a deadline; failed calls are evicted by each caller's cache. */
export async function fetchJSON<T>(url: string, message: string, timeoutMs = 30_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(message);
    return await response.json() as T;
  } catch {
    throw new Error(message);
  } finally {
    clearTimeout(timer);
  }
}
