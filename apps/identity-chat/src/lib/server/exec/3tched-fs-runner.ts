import { execFile } from "child_process";
import { promisify } from "util";

import { TypedError } from "../types.js";
import { makeError, getNextStep } from "../errors/typed-error.js";

const execFileAsync = promisify(execFile);

/**
 * Interface for the operation file runner.
 * Allows fake adapter to replace this in tests.
 */
export interface OperationFileRunner {
  run(args: {
    plugin: string;
    method: string;
    mountPath: string;
    identityFlag: "guest-kernel" | "host-session";
    expectedSession?: string;
    inputBytes: Uint8Array;
    confirmSideEffects: boolean;
  }): Promise<ExecutionResult>;
}

/**
 * Execution result from 3tched-fs runner.
 */
export type ExecutionResult =
  | { success: true; stdout: string; stderr: string }
  | { success: false; error: TypedError; stdout?: string; stderr?: string };

/**
 * 3tched-fs runner that spawns the real binary.
 */
export class ThreeTchedFsRunner implements OperationFileRunner {
  private binaryPath: string;
  private timeoutMs: number;

  constructor(binaryPath: string = "3tched-fs", timeoutMs: number = 30000) {
    this.binaryPath = binaryPath;
    this.timeoutMs = timeoutMs;
  }

  async run(args: {
    plugin: string;
    method: string;
    mountPath: string;
    identityFlag: "guest-kernel" | "host-session";
    expectedSession?: string;
    inputBytes: Uint8Array;
    confirmSideEffects: boolean;
  }): Promise<ExecutionResult> {
    const { plugin, method, mountPath, identityFlag, expectedSession, inputBytes, confirmSideEffects } = args;

    // Build argument array
    const argv = [this.binaryPath, "call", plugin, method, "--mount", mountPath];

    // Add identity flag
    if (identityFlag === "guest-kernel") {
      argv.push("--guest-kernel");
    } else if (identityFlag === "host-session" && expectedSession) {
      argv.push("--expected-session", expectedSession);
    }

    // Add stdin input flag
    argv.push("--args", "-");

    // Add confirm-side-effects flag
    if (confirmSideEffects) {
      argv.push("--confirm-side-effects");
    }

    try {
      const result = await execFileAsync(argv[0], argv.slice(1), {
        timeout: this.timeoutMs,
        maxBuffer: 16 * 1024 * 1024, // 16 MiB
        env: {
          PATH: process.env.PATH || "",
          LANG: process.env.LANG || "en_US.UTF-8"
        }
      });

      return { success: true, stdout: result.stdout, stderr: result.stderr };
    } catch (error: any) {
      const errorOutput = error.stderr || error.message || "Unknown error";
      const errorKind = this.classifyError(error, errorOutput);

      return {
        success: false,
        error: makeError(errorKind, `${plugin}.${method}`, getNextStep(errorKind), errorOutput)
      };
    }
  }

  /**
   * Classify error type.
   */
  private classifyError(error: any, stderr: string): "missing-mount" | "transport" | "schema" {
    if (stderr.includes("mount") || stderr.includes("not found")) {
      return "missing-mount";
    }
    if (stderr.includes("Error:") || stderr.includes("Diagnostic")) {
      return "transport";
    }
    return "schema";
  }
}

export const defaultRunner = new ThreeTchedFsRunner();
