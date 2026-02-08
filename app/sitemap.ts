import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://hackernews.coreyburns.ca";
  const sections = ["new", "past", "comments", "ask", "show", "jobs"];

  const mainPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "always" as const,
      priority: 1,
    },
    ...sections.map((section) => ({
      url: `${baseUrl}/?section=${section}`,
      lastModified: new Date(),
      changeFrequency: "always" as const,
      priority: 0.8,
    })),
  ];

  return mainPages;
}
