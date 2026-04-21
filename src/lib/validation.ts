const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'/]/g, c => HTML_ENTITIES[c] ?? c);
}

export function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}

// ─── JS Injection Detection ────────────────────────────────────────────────────

const DANGEROUS_PATTERNS = [
  /javascript\s*:/i,
  /on\w+\s*=/i,         // onerror=, onclick=, etc.
  /<script/i,
  /eval\s*\(/i,
  /expression\s*\(/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
];

export function containsDangerousContent(value: string): boolean {
  return DANGEROUS_PATTERNS.some(p => p.test(value));
}

// ─── Field-level Validators ────────────────────────────────────────────────────

export function isValidUsername(username: string): boolean {
  // 3–50 chars, alphanumeric + underscore only
  return /^[a-zA-Z0-9_]{3,50}$/.test(username);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function isValidRole(role: string): boolean {
  return ['admin', 'manager', 'kasir', 'gudang'].includes(role);
}

export function isValidPaymentMethod(method: string): boolean {
  return ['tunai', 'transfer', 'kartu_kredit', 'kartu_debit', 'qris'].includes(method);
}

export function isPositiveNumber(value: unknown): boolean {
  return typeof value === 'number' && isFinite(value) && value >= 0;
}

// ─── Sanitise a plain-text string (name, notes, etc.) ─────────────────────────

export function sanitiseText(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  const stripped = stripHtml(input).slice(0, maxLength).trim();
  if (containsDangerousContent(stripped)) {
    throw new ValidationError('Input mengandung konten yang tidak diperbolehkan.');
  }
  return stripped;
}

// ─── Validate login payload ───────────────────────────────────────────────────

export interface LoginPayload {
  username: string;
  password: string;
}

export function validateLoginPayload(body: unknown): LoginPayload {
  if (typeof body !== 'object' || body === null) {
    throw new ValidationError('Payload tidak valid.');
  }
  const { username, password } = body as Record<string, unknown>;

  if (typeof username !== 'string' || !username.trim()) {
    throw new ValidationError('Username wajib diisi.');
  }
  if (typeof password !== 'string' || !password) {
    throw new ValidationError('Password wajib diisi.');
  }
  if (!isValidUsername(username.trim())) {
    throw new ValidationError('Format username tidak valid.');
  }
  if (password.length > 128) {
    throw new ValidationError('Password terlalu panjang.');
  }
  return { username: username.trim(), password };
}

// ─── Generic DTO sanitiser ────────────────────────────────────────────────────

/**
 * Strip HTML from every string field of an object and check for injections.
 * Mutates a shallow copy — never mutates the original.
 */
export function sanitiseDto<T extends Record<string, unknown>>(dto: T): T {
  const out = { ...dto };
  for (const key of Object.keys(out)) {
    const val = out[key];
    if (typeof val === 'string') {
      (out as Record<string, unknown>)[key] = sanitiseText(val);
    }
  }
  return out;
}

// ─── Request body size guard ──────────────────────────────────────────────────

const DEFAULT_MAX_BODY_BYTES = 1 * 1024 * 1024; // 1 MB

export function assertBodySize(
  req: Request,
  maxBytes = DEFAULT_MAX_BODY_BYTES,
): void {
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    throw new ValidationError('Ukuran request terlalu besar.');
  }
}

// ─── Custom error ─────────────────────────────────────────────────────────────

export class ValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
