/**
 * fetchJson — Safe fetch wrapper untuk Ciomas Keramik
 *
 * Mengatasi masalah [object Event] yang terjadi ketika:
 * 1. fetch().then(r => r.json()) dipanggil tanpa cek r.ok
 * 2. API mengembalikan HTML error page (bukan JSON)
 * 3. Network error menyebabkan Event object ter-throw
 *
 * Usage:
 *   const data = await fetchJson('/api/products')
 *   const data = await fetchJson('/api/products/1', { method: 'DELETE' })
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Safe GET — returns parsed JSON or throws ApiError
 */
export async function fetchJson<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, options);
  } catch (networkError) {
    // Network error (DNS failure, CORS, connection refused, dll)
    // fetchError bisa berupa Event object — kita wrap jadi Error yang proper
    const msg = networkError instanceof Error
      ? networkError.message
      : 'Koneksi ke server gagal. Periksa jaringan Anda.';
    throw new ApiError(msg, 0);
  }

  // Cek apakah response adalah JSON
  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');

  if (!response.ok) {
    let errorMessage = `Error ${response.status}: ${response.statusText}`;
    if (isJson) {
      try {
        const body = await response.json();
        errorMessage = body.error ?? body.message ?? errorMessage;
      } catch {
        // ignore JSON parse error, gunakan pesan default
      }
    }
    throw new ApiError(errorMessage, response.status);
  }

  if (!isJson) {
    // Response bukan JSON (mungkin HTML error page dari Next.js)
    throw new ApiError('Server mengembalikan respons yang tidak valid.', response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError('Gagal memproses respons dari server.', response.status);
  }
}

/**
 * Safe POST/PUT/PATCH dengan JSON body
 */
export async function fetchJsonPost<T = unknown>(
  url: string,
  body: unknown,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST'
): Promise<T> {
  return fetchJson<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify(body),
  });
}

/**
 * Format error message dari berbagai tipe error
 * Menghindari "[object Event]", "[object Object]", dll.
 */
export function getErrorMessage(err: unknown, fallback = 'Terjadi kesalahan. Silakan coba lagi.'): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  // Tangani kasus [object Event] — Event object tidak punya .message
  return fallback;
}
