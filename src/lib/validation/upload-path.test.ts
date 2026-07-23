import { describe, expect, it } from "vitest";
import { uploadPathSchema } from "@/lib/validation/upload-path";

describe("uploadPathSchema", () => {
  it("accepts a same-origin upload path", () => {
    expect(uploadPathSchema.safeParse("/uploads/abc123.png").success).toBe(true);
  });

  it("rejects a javascript: URI", () => {
    expect(uploadPathSchema.safeParse("javascript:alert(1)").success).toBe(false);
  });

  it("rejects an absolute URL with an embedded userinfo SSRF trick", () => {
    expect(
      uploadPathSchema.safeParse("http://ourapp.com@attacker.com/uploads/x.png").success,
    ).toBe(false);
  });

  it("rejects a protocol-relative URL", () => {
    expect(uploadPathSchema.safeParse("//attacker.com/uploads/x.png").success).toBe(false);
  });

  it("rejects path traversal", () => {
    expect(uploadPathSchema.safeParse("/uploads/../../etc/passwd").success).toBe(false);
  });

  it("rejects a bare data: URI", () => {
    expect(uploadPathSchema.safeParse("data:text/html,<script>alert(1)</script>").success).toBe(
      false,
    );
  });
});
