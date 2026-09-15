import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@ai-sdk/harness", "@ai-sdk/harness-codex", "@ai-sdk/sandbox-vercel"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/d/**",
      },
      {
        protocol: "https",
        hostname: "fjwkfpwraipxmcjlwssv.supabase.co",
        pathname:
          "/storage/v1/object/sign/member-profile-photos/**",
      },
      {
        protocol: "https",
        hostname: "fjwkfpwraipxmcjlwssv.supabase.co",
        pathname: "/storage/v1/object/public/casa-event-images/**",
      },
    ],
  },
};

export default withWorkflow(nextConfig);
