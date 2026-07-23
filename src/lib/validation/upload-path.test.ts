import { describe, expect, it } from "vitest";
import { isOwnUploadUrl, uploadPathSchema } from "@/lib/validation/upload-path";

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

  it("rejects a Cloudinary-shaped URL when Cloudinary isn't configured", () => {
    expect(
      uploadPathSchema.safeParse("https://res.cloudinary.com/demo/image/upload/x.png").success,
    ).toBe(false);
  });
});

describe("isOwnUploadUrl with Cloudinary configured", () => {
  it("accepts a secure_url under our own cloud name", () => {
    expect(
      isOwnUploadUrl("https://res.cloudinary.com/my-cloud/image/upload/v1/tesajor-uploads/abc.png", "my-cloud"),
    ).toBe(true);
  });

  it("rejects a URL under a different cloud name", () => {
    expect(
      isOwnUploadUrl("https://res.cloudinary.com/someone-else/image/upload/abc.png", "my-cloud"),
    ).toBe(false);
  });

  it("rejects an http (non-https) Cloudinary-shaped URL", () => {
    expect(
      isOwnUploadUrl("http://res.cloudinary.com/my-cloud/image/upload/abc.png", "my-cloud"),
    ).toBe(false);
  });

  it("rejects the SSRF userinfo trick even with a matching cloud name in the path", () => {
    expect(
      isOwnUploadUrl("https://res.cloudinary.com@attacker.com/my-cloud/x.png", "my-cloud"),
    ).toBe(false);
  });

  it("still accepts local upload paths when a cloud name is configured", () => {
    expect(isOwnUploadUrl("/uploads/abc123.png", "my-cloud")).toBe(true);
  });

  it("escapes regex-special characters in the configured cloud name", () => {
    // If the "." in "my.cloud" weren't escaped, it would act as a
    // regex wildcard and incorrectly match "myXcloud" too.
    expect(isOwnUploadUrl("https://res.cloudinary.com/my.cloud/x.png", "my.cloud")).toBe(true);
    expect(isOwnUploadUrl("https://res.cloudinary.com/myXcloud/x.png", "my.cloud")).toBe(false);
  });
});
