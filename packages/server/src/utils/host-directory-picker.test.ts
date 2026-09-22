import { describe, expect, it } from "vitest";
import { isHostDirectoryPickerSupported, pickHostDirectory } from "./host-directory-picker.js";

function runs(result: { stdout?: string; stderr?: string; code: number }) {
  const calls: Array<{ command: string; args: string[] }> = [];
  return {
    calls,
    run: async (command: string, args: string[]) => {
      calls.push({ command, args });
      return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", code: result.code };
    },
  };
}

describe("pickHostDirectory", () => {
  it("returns the chosen directory without its trailing separator", async () => {
    const runner = runs({ stdout: "/Users/pat/dev/paseo/\n", code: 0 });

    await expect(pickHostDirectory({ platform: "darwin", run: runner.run })).resolves.toEqual({
      path: "/Users/pat/dev/paseo",
      cancelled: false,
    });
    expect(runner.calls[0]?.command).toBe("osascript");
  });

  it("reports a dismissed dialog as a cancellation rather than a failure", async () => {
    const runner = runs({ stderr: "execution error: User canceled. (-128)", code: 1 });

    await expect(pickHostDirectory({ platform: "darwin", run: runner.run })).resolves.toEqual({
      path: null,
      cancelled: true,
    });
  });

  it("fails when the dialog could not be shown at all", async () => {
    const runner = runs({ stderr: "execution error: Not authorized (-1743)", code: 1 });

    await expect(pickHostDirectory({ platform: "darwin", run: runner.run })).rejects.toThrow(
      "could not be opened",
    );
  });

  it("keeps the prompt inside the AppleScript string literal", async () => {
    const runner = runs({ stdout: "/tmp\n", code: 0 });

    await pickHostDirectory({
      platform: "darwin",
      run: runner.run,
      title: 'Pick "this" \\ folder',
    });

    const script = runner.calls[0]?.args[1] ?? "";
    expect(script).toContain('choose folder with prompt "Pick this  folder"');
    expect(script.match(/"/gu)).toHaveLength(4);
  });

  it("refuses on a host with no chooser to open", async () => {
    expect(isHostDirectoryPickerSupported("linux")).toBe(false);
    await expect(pickHostDirectory({ platform: "linux" })).rejects.toThrow(
      "cannot open a folder chooser",
    );
  });
});
