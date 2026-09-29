import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { whatsAppMetaCloudAdapter } from "../adapters/whatsapp-meta-cloud.js";

const SECRETS = { appSecret: "test-app-secret", webhookVerifyToken: "test-verify-token" };

describe("whatsAppMetaCloudAdapter (unit)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("verifyWebhookChallenge returns the challenge only for mode=subscribe and a matching token", () => {
    expect(whatsAppMetaCloudAdapter.verifyWebhookChallenge({ "hub.mode": "subscribe", "hub.verify_token": "test-verify-token", "hub.challenge": "abc" }, SECRETS)).toBe("abc");
    expect(whatsAppMetaCloudAdapter.verifyWebhookChallenge({ "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "abc" }, SECRETS)).toBeNull();
    expect(whatsAppMetaCloudAdapter.verifyWebhookChallenge({ "hub.mode": "unsubscribe", "hub.verify_token": "test-verify-token", "hub.challenge": "abc" }, SECRETS)).toBeNull();
  });

  it("verifyWebhookSignature accepts a correctly signed body and rejects a tampered one", () => {
    const rawBody = JSON.stringify({ hello: "world" });
    const validSignature = "sha256=" + createHmac("sha256", SECRETS.appSecret).update(rawBody, "utf8").digest("hex");
    expect(whatsAppMetaCloudAdapter.verifyWebhookSignature(rawBody, validSignature, SECRETS)).toBe(true);

    const tamperedBody = JSON.stringify({ hello: "world!" });
    expect(whatsAppMetaCloudAdapter.verifyWebhookSignature(tamperedBody, validSignature, SECRETS)).toBe(false);
    expect(whatsAppMetaCloudAdapter.verifyWebhookSignature(rawBody, undefined, SECRETS)).toBe(false);
    expect(whatsAppMetaCloudAdapter.verifyWebhookSignature(rawBody, "not-even-hex-formatted", SECRETS)).toBe(false);
  });

  it("sendMessage in fixture mode never hits the network and returns a deterministic fixture id", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await whatsAppMetaCloudAdapter.sendMessage({ mode: "fixture" }, { accessToken: "unused" }, "919000000000", "hello");
    expect(result.providerMessageId).toMatch(/^FIXTURE_WAMID_/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sendMessage in fixture mode embeds the phoneNumberId it was given, so a caller can prove which line it would have sent from", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const withEndpoint = await whatsAppMetaCloudAdapter.sendMessage({ mode: "fixture", phoneNumberId: "SPECIFIC_LINE_ID" }, { accessToken: "unused" }, "919000000000", "hello");
    expect(withEndpoint.providerMessageId).toContain("SPECIFIC_LINE_ID");

    const withoutEndpoint = await whatsAppMetaCloudAdapter.sendMessage({ mode: "fixture" }, { accessToken: "unused" }, "919000000000", "hello");
    expect(withoutEndpoint.providerMessageId).toContain("unknown");
  });

  it("sendMessage in live mode posts to the Graph API and returns the wamid from the response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: "wamid.LIVE123" }] }) }),
    );
    const result = await whatsAppMetaCloudAdapter.sendMessage({ phoneNumberId: "PNID" }, { accessToken: "tok" }, "919000000000", "hello");
    expect(result.providerMessageId).toBe("wamid.LIVE123");
  });

  it("sendMessage in live mode throws (does not silently swallow) when the Graph API call fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => '{"error":"invalid token"}' }));
    await expect(whatsAppMetaCloudAdapter.sendMessage({ phoneNumberId: "PNID" }, { accessToken: "bad" }, "919000000000", "hello")).rejects.toThrow(/WhatsApp send failed/);
  });

  it("sendMessage in live mode throws on a network error (e.g. a provider timeout) instead of returning a fake success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network timeout")));
    await expect(whatsAppMetaCloudAdapter.sendMessage({ phoneNumberId: "PNID" }, { accessToken: "tok" }, "919000000000", "hello")).rejects.toThrow(/network timeout/);
  });
});
