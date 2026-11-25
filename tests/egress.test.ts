import { test } from "node:test";
import assert from "node:assert/strict";
import { isPrivateAddress } from "../src/lib/voice/ip";

/**
 * The address classifier behind the SSRF guard.
 *
 * These are judgements about a *resolved* address, which is the whole point:
 * a hostname string can be spelled a hundred ways and can be repointed at
 * will, so nothing is decided until the resolver has answered.
 */

test("loopback is refused however it is written", () => {
  for (const ip of ["127.0.0.1", "127.1.2.3", "::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPrivateAddress(ip), true, `${ip} should be refused`);
  }
});

test("cloud metadata is refused", () => {
  // The single most valuable SSRF target on any cloud host.
  assert.equal(isPrivateAddress("169.254.169.254"), true);
  assert.equal(isPrivateAddress("169.254.0.1"), true);
});

test("every RFC1918 range is refused", () => {
  for (const ip of ["10.0.0.1", "10.255.255.255", "172.16.0.1", "172.31.255.255", "192.168.1.1"]) {
    assert.equal(isPrivateAddress(ip), true, `${ip} should be refused`);
  }
});

test("addresses just outside RFC1918 are allowed", () => {
  for (const ip of ["172.15.255.255", "172.32.0.1", "192.167.1.1", "11.0.0.1"]) {
    assert.equal(isPrivateAddress(ip), false, `${ip} is public and should be allowed`);
  }
});

test("carrier-grade NAT is refused", () => {
  assert.equal(isPrivateAddress("100.64.0.1"), true);
  assert.equal(isPrivateAddress("100.127.255.255"), true);
  // 100.63 and 100.128 sit outside the range and are ordinary public space.
  assert.equal(isPrivateAddress("100.63.255.255"), false);
  assert.equal(isPrivateAddress("100.128.0.1"), false);
});

test("this-network, benchmarking, multicast and reserved space are refused", () => {
  for (const ip of ["0.0.0.0", "0.1.2.3", "192.0.0.1", "198.18.0.1", "198.19.0.1", "224.0.0.1", "240.0.0.1", "255.255.255.255"]) {
    assert.equal(isPrivateAddress(ip), true, `${ip} should be refused`);
  }
});

test("IPv6 unique-local and link-local are refused", () => {
  for (const ip of ["fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::"]) {
    assert.equal(isPrivateAddress(ip), true, `${ip} should be refused`);
  }
});

test("ordinary public addresses are allowed", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"]) {
    assert.equal(isPrivateAddress(ip), false, `${ip} should be allowed`);
  }
});

test("anything that is not a well-formed address is refused", () => {
  // Fail closed: if we cannot say what it is, we do not dial it.
  for (const value of ["", "not-an-ip", "1.2.3", "1.2.3.4.5", "999.1.1.1", "1.2.3.-1"]) {
    assert.equal(isPrivateAddress(value), true, `${value} should be refused`);
  }
});
