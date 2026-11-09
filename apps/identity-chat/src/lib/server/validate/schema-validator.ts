import { Ajv2020 } from "ajv";
import addFormats from "ajv-formats";

import { TypedError } from "../types.js";
import { makeError, getNextStep } from "../errors/typed-error.js";

export class SchemaValidator {
  private validator: Ajv2020;

  constructor() {
    this.validator = new Ajv2020({
      strict: false,
      allErrors: true,
      coerceTypes: false,
      useDefaults: false,
      removeAdditional: false
    });
    addFormats(this.validator);
  }

  /**
   * Compile a schema for reuse.
   */
  compileSchema(schema: unknown): (data: unknown) => boolean {
    return this.validator.compile(schema);
  }

  /**
   * Validate input against a schema.
   * Returns the validated value and input bytes, or failures.
   */
  validate(schema: unknown, input: unknown): ValidationResult {
    // Check if input is a JSON value (string, number, boolean, null, object, array)
    if (!this.isJsonValue(input)) {
      return { ok: false, failures: [{ path: "", constraint: "type" }] };
    }

    // Render the accepted value once with JSON.stringify
    const inputBytes = new TextEncoder().encode(JSON.stringify(input));

    // Check 1 MiB bound
    if (inputBytes.length > 1024 * 1024) {
      return { ok: false, failures: [{ path: "", constraint: "size" }] };
    }

    // Compile and validate
    const valid = this.validator.compile(schema)(input);
    if (!valid) {
      const failures = this.validator.errors?.map(err => ({
        path: err.instancePath || "",
        constraint: err.keyword
      })) ?? [];
      return { ok: false, failures };
    }

    return { ok: true, value: input, inputBytes };
  }

  /**
   * Check if a value is a valid JSON value.
   */
  private isJsonValue(value: unknown): value is string | number | boolean | null | { [key: string]: unknown } | unknown[] {
    if (value === null) {
      return true;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return true;
    }
    if (Array.isArray(value)) {
      return value.every(v => this.isJsonValue(v));
    }
    if (typeof value === "object") {
      return Object.entries(value).every(([k, v]) => typeof k === "string" && this.isJsonValue(v));
    }
    return false;
  }
}

export type ValidationResult =
  | { ok: true; value: unknown; inputBytes: Uint8Array }
  | { ok: false; failures: { path: string; constraint: string }[] };

export const schemaValidator = new SchemaValidator();
