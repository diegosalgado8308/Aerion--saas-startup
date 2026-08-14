"use client";

function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "diagram"
  );
}

export default function DiagramExportButtons({ jsonExportUrl, diagramName }) {
  function handleExportSvg() {
    const svg = document.getElementById("economy-diagram-svg");
    if (!svg) return;

    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    const serialized = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([serialized], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(diagramName)}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <a href={jsonExportUrl} download className="btn btn-secondary btn-sm">Export JSON</a>
      <button type="button" onClick={handleExportSvg} className="btn btn-secondary btn-sm">Export SVG</button>
    </div>
  );
}
