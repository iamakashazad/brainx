import { log } from "../logger";

describe("logger", () => {
  it("redacts binary values", () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const file = new File([new Uint8Array(8)], "x.png", { type: "image/png" });
    const buffer = new ArrayBuffer(8);
    const formData = new FormData();
    formData.append("file", file);

    log("upload", "ok", {
      file,
      buffer,
      formData,
      items: [file, buffer, "kept"],
    });

    expect(consoleInfo).toHaveBeenCalledTimes(1);
    const [, context] = consoleInfo.mock.calls[0] ?? [];
    expect(JSON.stringify(context)).toContain("[redacted-binary]");
    expect(context).not.toBe(file);

    consoleInfo.mockRestore();
  });
});
