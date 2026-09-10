import { TakoError } from '@kurotako/core';

class OpenApiError extends TakoError {
  constructor(code: string, detail: string, options?: { cause?: unknown }) {
    super(code, `openapi parser: ${detail}`, options);
  }
}
export class OpenApiInputError extends OpenApiError {
  constructor(detail: string, options?: { cause?: unknown }) {
    super('openapi_input', detail, options);
  }
}
export class OpenApiLoadError extends OpenApiError {
  constructor(detail: string, options?: { cause?: unknown }) {
    super('openapi_load', detail, options);
  }
}
export class OpenApiDocumentError extends OpenApiError {
  constructor(detail: string, options?: { cause?: unknown }) {
    super('openapi_document', detail, options);
  }
}
export class OpenApiReferenceError extends OpenApiError {
  constructor(detail: string, options?: { cause?: unknown }) {
    super('openapi_reference', detail, options);
  }
}
export class OpenApiUnsupportedError extends OpenApiError {
  constructor(detail: string, options?: { cause?: unknown }) {
    super('openapi_unsupported', detail, options);
  }
}
export class OpenApiNameCollisionError extends OpenApiError {
  constructor(detail: string) {
    super('openapi_name_collision', detail);
  }
}
