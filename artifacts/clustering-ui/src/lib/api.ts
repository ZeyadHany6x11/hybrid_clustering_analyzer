export async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const text = await response.text();

  if (!text.trim()) {
    throw new Error(`${fallbackMessage}: empty response from API`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const detail = text.replace(/\s+/g, " ").trim().slice(0, 180);
    throw new Error(`${fallbackMessage}: API returned non-JSON response${detail ? ` (${detail})` : ""}`);
  }
}
