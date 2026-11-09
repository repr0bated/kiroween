import { CredentialClass } from "../types.js";

interface HeldValue {
  value: Uint8Array;
  encodings: Map<string, Set<string>>;
}

export class CredentialRegistry {
  private heldValues: Map<string, HeldValue> = new Map();

  /**
   * Register a held value for a credential class.
   * Precomputes all encoded windows for 16-byte detection.
   */
  registerHeld(cls: CredentialClass, value: Uint8Array): void {
    const key = this.hashValue(value);
    this.heldValues.set(key, {
      value,
      encodings: this.computeEncodings(value)
    });
  }

  /**
   * Check if an item contains any held credential material.
   * Returns the credential class if found, undefined otherwise.
   */
  checkItem(item: string | Uint8Array): CredentialClass | undefined {
    const bytes = typeof item === "string" ? new TextEncoder().encode(item) : item;

    for (const [cls, held] of this.heldValues) {
      if (this.containsHeldValue(bytes, held)) {
        return cls as CredentialClass;
      }
    }
    return undefined;
  }

  /**
   * Check if an item contains any SID1/OIA1 envelope pattern.
   */
  checkEnvelope(item: string | Uint8Array): CredentialClass | undefined {
    const text = typeof item === "string" ? item : new TextDecoder().decode(item);
    const patterns = [/SID1[A-Za-z0-9+/=_.:-]{16,}/, /OIA1[A-Za-z0-9+/=_.:-]{16,}/];
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return pattern.test(text.replace(/SID1/, "XXX")) ? "sid1" : "oia1";
      }
    }
    return undefined;
  }

  /**
   * Check for declared secret fields in JSON.
   */
  checkDeclaredSecrets(item: string | Uint8Array): CredentialClass | undefined {
    const text = typeof item === "string" ? item : new TextDecoder().decode(item);
    if (text.includes("sealed_id") || text.includes("x-oscal-subid")) {
      return "declared-secret-field";
    }
    return undefined;
  }

  private hashValue(value: Uint8Array): string {
    // Simple hash for registry lookup
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = ((hash << 5) - hash) + value[i];
      hash |= 0;
    }
    return `0x${Math.abs(hash).toString(16)}`;
  }

  private computeEncodings(value: Uint8Array): Map<string, Set<string>> {
    const encodings = new Map<string, Set<string>>();

    // Raw UTF-8
    const windows = this.computeWindows(value);
    encodings.set("raw", windows);

    // Base64
    const base64 = btoa(String.fromCharCode(...value));
    encodings.set("base64", this.computeWindows(new TextEncoder().encode(base64)));

    // Base64URL
    const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    encodings.set("base64url", this.computeWindows(new TextEncoder().encode(base64url)));

    // Hex
    const hex = Array.from(value)
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    encodings.set("hex", this.computeWindows(new TextEncoder().encode(hex)));

    return encodings;
  }

  private computeWindows(bytes: Uint8Array): Set<string> {
    const windows = new Set<string>();
    for (let i = 0; i <= bytes.length - 16; i++) {
      const window = bytes.slice(i, i + 16);
      windows.add(btoa(String.fromCharCode(...window)));
    }
    return windows;
  }

  private containsHeldValue(bytes: Uint8Array, held: HeldValue): boolean {
    for (const window of held.encodings.values()) {
      const encoded = btoa(String.fromCharCode(...bytes));
      if (window.has(encoded)) {
        return true;
      }
    }
    return false;
  }
}
