/** Parse SHA-256 cert fingerprints for Digital Asset Links / TWA. */
export function parseTwaSha256Fingerprints(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\s,;]+/)
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^[0-9A-F:]+$/.test(value) && value.includes(":"));
}

export function buildAssetLinksDocument(
  packageName: string,
  fingerprints: string[],
): Array<{
  relation: string[];
  target: {
    namespace: string;
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
}> {
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}
