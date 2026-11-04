///  Utils / Label Create - Validates and normalizes repository label creation bodies.

/** Normalized payload accepted by the GitHub label creation endpoint. */
export interface LabelCreatePayload {
  name: string;
  color: string;
  description?: string;
}

const HEX_COLOR_PATTERN = /^[0-9a-fA-F]{6}$/;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 200;

function throwValidationError(statusMessage: string): never {
  if (typeof createError === 'function') {
    throw createError({ statusCode: 400, statusMessage });
  }
  throw Object.assign(new Error(statusMessage), { statusCode: 400, statusMessage });
}

/** Validate and normalize a label creation body: name, six-digit hex color, optional description. */
export function normalizeLabelCreateBody(body: unknown): LabelCreatePayload {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throwValidationError('name and color are required');
  }

  const record = body as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const color = typeof record.color === 'string' ? record.color.trim().replace(/^#/, '') : '';

  if (!name) {
    throwValidationError('name must be a non-empty string');
  }
  if (name.length > MAX_NAME_LENGTH) {
    throwValidationError(`name must be at most ${MAX_NAME_LENGTH} characters`);
  }
  if (!HEX_COLOR_PATTERN.test(color)) {
    throwValidationError('color must be a six-digit hex value');
  }

  const payload: LabelCreatePayload = { name, color: color.toLowerCase() };

  if (record.description !== undefined && record.description !== null) {
    if (typeof record.description !== 'string') {
      throwValidationError('description must be a string');
    }
    const description = record.description.trim();
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      throwValidationError(`description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
    }
    payload.description = description;
  }

  return payload;
}
