import {
  ValidateBy,
  type ValidationOptions,
} from 'class-validator';

function getUrlError(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    return 'URL is required and must be a string';
  }

  if (value.length > 2048) {
    return 'URL must not exceed 2048 characters';
  }

  if (/[\s\u0000-\u001F\u007F\\]/u.test(value)) {
    return 'URL must be a valid URL without whitespace or backslashes';
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    return 'URL must be a valid URL';
  }

  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    !/^https?:\/\//i.test(value)
  ) {
    return 'URL must start with http:// or https://';
  }

  if (!parsed.hostname) {
    return 'URL must contain a hostname';
  }

  const authority = value
    .slice(value.indexOf('://') + 3)
    .split(/[/?#]/, 1)[0];

  if (
    parsed.username !== '' ||
    parsed.password !== '' ||
    authority.includes('@')
  ) {
    return 'URL must not contain credentials';
  }

  return null;
}

export function IsAttachmentUrl(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isAttachmentUrl',
      validator: {
        validate: (value: unknown) => getUrlError(value) === null,
        defaultMessage: (args) =>
          getUrlError(args?.value) ?? 'URL must be valid',
      },
    },
    validationOptions,
  );
}