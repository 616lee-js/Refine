/**
 * Supabase Root 2021 CA — the trust anchor for Postgres connections.
 *
 * ── Why this is pinned ────────────────────────────────────────────────────────
 * Supabase serves its Postgres and pooler endpoints from its own private PKI,
 * not a publicly-trusted CA. Verified empirically against this project's pooler:
 * every configuration that checks the system trust store fails with
 * SELF_SIGNED_CERT_IN_CHAIN, including `ssl: true`, `sslmode=require`, and
 * `sslmode=verify-full`. Only two configurations connect — one that does not
 * encrypt at all, and one that encrypts without verifying the peer.
 *
 * (Supabase's HTTPS API *is* publicly trusted. It is only the database
 * endpoints that use this CA. Easy to conflate.)
 *
 * Pinning is therefore the only route to genuinely verified TLS here, and it is
 * stronger than the system store would be: exactly one issuer is accepted.
 *
 * ── Identity ──────────────────────────────────────────────────────────────────
 * Subject/Issuer: C=US, ST=Delware, L=New Castle, O=Supabase Inc,
 *                 CN=Supabase Root 2021 CA   (self-signed)
 * Valid:          2021-04-28 → 2031-04-26
 * SHA-256:        80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:
 *                 82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA
 *
 * ── Provenance (read before trusting this blindly) ────────────────────────────
 * Confirmed by fingerprint agreement between two sources: the root presented by
 * the live pooler connection, and the certificate published at Supabase's public
 * download bucket. They are byte-identical.
 *
 * It was NOT confirmed against the authenticated Supabase dashboard, which would
 * be the authoritative source. See LIM-017. If you are ever in that dashboard,
 * compare the SHA-256 above and delete this paragraph once it matches.
 *
 * ── Rotation ──────────────────────────────────────────────────────────────────
 * Expiry is 2031. `ca` accepts an array, so a replacement root can be added
 * alongside this one ahead of any cutover — no flag day. Failure is loud rather
 * than silent: connections refuse outright, and the daily /api/health cron
 * surfaces it within 24 hours.
 *
 * Inlined as a module rather than read from a .crt at runtime, for the same
 * reason the Layer 2/3 prompts are: no filesystem dependency, nothing that can
 * be missing from a serverless bundle, and a missing value is a build error.
 */
export const SUPABASE_ROOT_CA_2021 = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----
`;

/** Expected SHA-256 fingerprint, for verification tooling. */
export const SUPABASE_ROOT_CA_2021_SHA256 =
  "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA";
