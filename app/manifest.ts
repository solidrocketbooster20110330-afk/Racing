import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Racing — Motorsport Simulator",
    short_name: "Racing",
    description: "A mobile-friendly 3D racing simulator.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "fullscreen"],
    orientation: "landscape",
    background_color: "#08080d",
    theme_color: "#08080d",
    icons: [
      {
        src: "/racing-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/racing-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
