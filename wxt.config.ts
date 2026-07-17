import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: "Elasticvix - Elasticsearch Client",
    description:
      "Elasticsearch client with query console, field-aware autocomplete, saved queries, and multi-cluster support. For ES 6.x-9.x.",
    permissions: ["storage"],
    host_permissions: ["http://*/*", "https://*/*"],
    action: {},
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAj6ToVWSniUoFJZkNPSb2KnzaktiEZ5rWaWqGmYCpSnIPL3MXpVn3+KuF8cewPeHaI39sZhK8qZTiu+/xq2J5hOZFMrV9D3BRoTS9Qa9K50cuebA8U3vPxhEfXNS1qK/4fn1q/8BKF8yAZKdRJl8zE7+uz3uBlmRHV0u1Eklwbj/0hMRM9xrScGKyr4qs4Nk4XtbgBJhjdQCnSQxHSCs5kKbUSNHYwG6/8JIQ2zBdHIpPOIfs9PCxdlJ8z/H3cYlKt0ngVfDxQnRcOgnvhlYdoKfhvyOgYHqJRoM3jQvFChb3jR5Znypy3x+Z038FgwakfIyBaAIgw8iYas5rD1rLTwIDAQAB",
  },
});
