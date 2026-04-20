import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PAPPY Clothing — Born Above | Limited Edition Hoodie Pre-Order" },
      {
        name: "description",
        content:
          "Born Above. The debut limited-edition hoodie from PAPPY Clothing. 200 units worldwide. Pre-order now.",
      },
      { property: "og:title", content: "PAPPY Clothing — Born Above" },
      { property: "og:description", content: "The debut hoodie. Limited to 200 units. Pre-order now." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <iframe
      src="/site/index.html"
      title="PAPPY Clothing"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        border: 0,
        display: "block",
      }}
    />
  );
}
