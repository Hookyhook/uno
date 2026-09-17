import { describe, expect, it } from "vitest";
import { findCredentials } from "./store";

const URL_A = "https://apn1-ace-cat-12345.upstash.io";
const URL_B = "https://eu2-wise-dog-67890.upstash.io";

describe("findCredentials", () => {
  it("finds the documented Upstash names", () => {
    expect(findCredentials({ UPSTASH_REDIS_REST_URL: URL_A, UPSTASH_REDIS_REST_TOKEN: "tok" })).toEqual({
      url: URL_A,
      token: "tok",
    });
  });

  it("finds Vercel's KV aliases", () => {
    expect(findCredentials({ KV_REST_API_URL: URL_A, KV_REST_API_TOKEN: "tok" })).toEqual({ url: URL_A, token: "tok" });
  });

  it("finds credentials behind an arbitrary integration prefix", () => {
    expect(findCredentials({ STORAGE_URL: URL_A, STORAGE_TOKEN: "tok" })).toEqual({ url: URL_A, token: "tok" });
    expect(findCredentials({ MY_DB_REST_URL: URL_A, MY_DB_REST_TOKEN: "tok" })).toEqual({ url: URL_A, token: "tok" });
    expect(findCredentials({ MY_DB_URL: URL_A, MY_DB_REST_TOKEN: "tok" })).toEqual({ url: URL_A, token: "tok" });
  });

  it("prefers the UPSTASH-prefixed pair when several are present", () => {
    const found = findCredentials({
      STORAGE_URL: URL_B,
      STORAGE_TOKEN: "other",
      UPSTASH_REDIS_REST_URL: URL_A,
      UPSTASH_REDIS_REST_TOKEN: "tok",
    });
    expect(found).toEqual({ url: URL_A, token: "tok" });
  });

  it("ignores non-Upstash URLs and unpaired or blank values", () => {
    expect(findCredentials({})).toBeNull();
    expect(findCredentials({ DATABASE_URL: "https://example.com", DATABASE_TOKEN: "tok" })).toBeNull();
    expect(findCredentials({ STORAGE_URL: URL_A })).toBeNull();
    expect(findCredentials({ STORAGE_URL: URL_A, STORAGE_TOKEN: "  " })).toBeNull();
    expect(findCredentials({ STORAGE_URL: `redis://foo.upstash.io`, STORAGE_TOKEN: "tok" })).toBeNull();
  });

  it("trims whitespace from pasted values", () => {
    expect(findCredentials({ STORAGE_URL: ` ${URL_A} `, STORAGE_TOKEN: " tok " })).toEqual({ url: URL_A, token: "tok" });
  });
});
