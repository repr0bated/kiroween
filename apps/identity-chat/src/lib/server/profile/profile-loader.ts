import {Ajv2020} from "ajv";
import addFormats from "ajv-formats";

import identityProfileSchema from "../../../config/identity-profile.schema.json" with { type: "json" };
import { IdentityProfile, TypedError } from "../types.js";
import { makeError, getNextStep } from "../errors/typed-error.js";
import { checkRequestIntake } from "../guard/request-intake.js";

export class ProfileLoader {
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
    this.validator.compile(identityProfileSchema);
  }

  /**
   * Parse and validate an Identity_Profile from bytes.
   */
  parse(bytes: Uint8Array): ProfileResult {
    // Size check (<= 65 536 bytes)
    if (bytes.length > 65536) {
      return { ok: false, errors: [{ path: "", constraint: "size", message: "Profile exceeds 65536 bytes" }] };
    }

    // Strict UTF-8 decode
    let text: string;
    try {
      text = new TextDecoder().decode(bytes);
    } catch (e) {
      return { ok: false, errors: [{ path: "", constraint: "encoding", message: "Invalid UTF-8" }] };
    }

    // Duplicate-key-rejecting JSON.parse
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { ok: false, errors: [{ path: "", constraint: "json", message: "Invalid JSON" }] };
    }

    // Ajv validation
    const valid = this.validator.validate(identityProfileSchema, data);
    if (!valid) {
      const errors = this.validator.errors?.map(err => ({
        path: err.instancePath || "",
        constraint: err.keyword,
        message: err.message ?? "Validation failed"
      })) ?? [];
      return { ok: false, errors };
    }

    // Secret_Guard pass on every string
    const stringValues = this.extractStringValues(data);
    for (const value of stringValues) {
      const result = checkRequestIntake(value);
      if (!result.ok) {
        return { ok: false, errors: [{ path: "", constraint: "credential", message: "Contains credential material" }] };
      }
    }

    // Construct immutable result
    const profile = data as IdentityProfile;
    return { ok: true, profile: Object.freeze(profile) };
  }

  /**
   * Format an Identity_Profile to canonical JSON bytes.
   */
  format(profile: IdentityProfile): Uint8Array {
    // Extract the fields in schema order
    const canonical: Record<string, unknown> = {
      format: profile.format,
      principal_id: profile.principal_id,
      display_name: profile.display_name,
      deployment_targets: profile.deployment_targets
    };

    if (profile.expected_session_id !== undefined) {
      canonical.expected_session_id = profile.expected_session_id;
    }

    if (profile.session_mode !== undefined) {
      canonical.session_mode = profile.session_mode;
    }

    // Canonical JSON (no whitespace, sorted keys)
    const json = JSON.stringify(canonical);
    return new TextEncoder().encode(json);
  }

  /**
   * Resolve the session mode from the profile.
   * Returns one of: standard, control_plane, ui_build
   */
  resolveSessionMode(profile: IdentityProfile): "standard" | "control_plane" | "ui_build" {
    const mode = profile.session_mode;
    if (mode === "standard" || mode === "control_plane" || mode === "ui_build") {
      return mode;
    }
    return "standard";
  }

  /**
   * Get the tool call limit for a session mode.
   */
  getToolCallLimit(mode: "standard" | "control_plane" | "ui_build"): number {
    if (mode === "control_plane" || mode === "ui_build") {
      return 5000;
    }
    return 5;
  }

  /**
   * Extract all string values from a JSON object for credential checking.
   */
  private extractStringValues(obj: unknown): string[] {
    const strings: string[] = [];

    function extract(value: unknown): void {
      if (typeof value === "string") {
        strings.push(value);
      } else if (Array.isArray(value)) {
        value.forEach(extract);
      } else if (value && typeof value === "object") {
        Object.values(value).forEach(extract);
      }
    }

    extract(obj);
    return strings;
  }
}

export type ProfileResult =
  | { ok: true; profile: IdentityProfile }
  | { ok: false; errors: ProfileFieldError[] };

export interface ProfileFieldError {
  path: string;
  constraint: string;
  message: string;
}

export const profileLoader = new ProfileLoader();
