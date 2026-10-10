import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jauge", short_name: "Jauge", start_url: "/", display: "standalone",
    background_color: "#f6f5f1", theme_color: "#0f5c4d",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
