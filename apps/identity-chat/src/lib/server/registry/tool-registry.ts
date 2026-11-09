import { ViewKind, RegistryEntry, RegistrySnapshot, HeldCapabilityResult, CatalogPin } from "../types.js";

/**
 * Interface for the tool registry derivation function.
 * Pure function of its inputs - reads no other partition.
 */
export interface ToolRegistry {
  derive(input: {
    describe: MountedDescribe;
    held: HeldCapabilityResult;
    catalog: CatalogPin;
    exclusions: ReadonlySet<string>;
    stickyDenied: ReadonlySet<ToolKey>;
  }): RegistrySnapshot;
  aiSdkTools(snapshot: RegistrySnapshot): Record<string, AiSdkToolNoExecute>;
}

/**
 * Interface for mounted description (from 3tched-fs describe output).
 */
export interface MountedDescribe {
  [pluginId: string]: {
    [method: string]: {
      args: unknown;
      returns: unknown | null;
      side_effect: "read" | "mutation";
      idempotent: boolean;
      required_capability: string | null;
      subid: string;
    };
  };
}

/**
 * AI SDK tool definition without execute function.
 */
export interface AiSdkToolNoExecute {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: unknown;
  };
}

/**
 * Tool registry implementation.
 */
export class ToolRegistryImpl implements ToolRegistry {
  /**
   * Derive registry from both views' discovery outputs.
   * Pure function - reads no other partition.
   */
  derive(input: {
    describe: MountedDescribe;
    held: HeldCapabilityResult;
    catalog: CatalogPin;
    exclusions: ReadonlySet<string>;
    stickyDenied: ReadonlySet<ToolKey>;
  }): RegistrySnapshot {
    const entries = new Map<string, RegistryEntry>();

    // Process each plugin and method from the describe output
    for (const [pluginId, methods] of Object.entries(input.describe)) {
      // Skip excluded plugin names
      if (input.exclusions.has(pluginId)) {
        continue;
      }

      for (const [method, decl] of Object.entries(methods)) {
        const toolKey = `${pluginId}\u0000${method}`;
        const viewKind = pluginId === "threetched" ? "threetched" : "3tched";

        // Check for wrong-view schemas
        if (pluginId === "threetched" && viewKind !== "threetched") {
          // Naming defect - exclude and record blocker
          continue;
        }

        // Create registry entry
        const entry: RegistryEntry = {
          toolName: this.makeToolName(pluginId, method),
          plugin: pluginId,
          method: method,
          viewKind: viewKind as ViewKind,
          args: decl.args,
          returns: decl.returns,
          requiredCapability: decl.required_capability,
          sideEffect: decl.side_effect,
          idempotent: decl.idempotent,
          subid: decl.subid,
          status: this.determineStatus(decl, input.held, input.stickyDenied)
        };

        entries.set(toolKey, entry);
      }
    }

    return {
      pin: input.catalog,
      entries
    };
  }

  /**
   * Convert registry snapshot to AI SDK tools.
   * Only offers tools that are available.
   */
  aiSdkTools(snapshot: RegistrySnapshot): Record<string, AiSdkToolNoExecute> {
    const tools: Record<string, AiSdkToolNoExecute> = {};

    for (const [key, entry] of snapshot.entries) {
      if (entry.status.offered) {
        tools[entry.toolName] = {
          type: "function",
          function: {
            name: entry.toolName,
            parameters: entry.args
          }
        };
      }
    }

    return tools;
  }

  /**
   * Make an AI SDK tool name from plugin and method.
   * Sanitized to [A-Za-z0-9_-] with collision handling.
   */
  private makeToolName(plugin: string, method: string): string {
    const base = `${plugin}__${method}`
      .replace(/[^A-Za-z0-9_-]/g, "_");
    return base;
  }

  /**
   * Determine if a tool is offered or unavailable.
   */
  private determineStatus(
    decl: { required_capability: string | null },
    held: HeldCapabilityResult,
    stickyDenied: ReadonlySet<string>
  ): { offered: true } | { offered: false; reason: "absent" | "undetermined"; detail: string } {
    // Check if sticky denied
    const toolKey = `${decl.required_capability ?? "none"}`;
    if (stickyDenied.has(toolKey)) {
      return { offered: false, reason: "absent", detail: "Sticky denial" };
    }

    // Required capability must be declared
    if (decl.required_capability === null) {
      return { offered: false, reason: "absent", detail: "No required capability declared" };
    }

    // Check held capabilities
    if (held.kind === "set") {
      if (held.capabilities.has(decl.required_capability)) {
        return { offered: true };
      }
      return { offered: false, reason: "absent", detail: `Missing capability: ${decl.required_capability}` };
    }

    return { offered: false, reason: "undetermined", detail: "Cannot determine held capabilities" };
  }
}

export const toolRegistry = new ToolRegistryImpl();
