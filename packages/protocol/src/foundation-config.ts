import { z } from "zod";

// Daemon-config leaves shared by the wire schema and config loading; kept apart from
// messages.ts so loading configuration does not load every wire schema.
export const FoundationCredentialRefSchema = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/u);
export const BeadsCentralEndpointSchema = z.url().superRefine((value, context) => {
  const endpoint = new URL(value);
  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    context.addIssue({
      code: "custom",
      message: "Beads Central endpoint must use http or https",
    });
  }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    context.addIssue({
      code: "custom",
      message: "Beads Central endpoint must not contain credentials, query, or fragment",
    });
  }
});
