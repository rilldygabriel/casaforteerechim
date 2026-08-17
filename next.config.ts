import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
    ],
  },
};

export default nextConfig;
