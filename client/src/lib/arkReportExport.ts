/* Shared ARK Report export helpers — used by the /report page and the
   profile-page "Download My ARK Report" button so capture/export behaviour
   stays identical across surfaces. */

export function reportFileStamp(name?: string | null) {
  const n = (name || "ARK").replace(/[^a-z0-9]+/gi, "_");
  return `ARK_Report_${n}_${new Date().toISOString().slice(0, 10)}`;
}

async function waitForImages(el: HTMLElement) {
  const imgs = Array.from(el.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });
    }),
  );
}

async function captureCanvas(el: HTMLElement) {
  const html2canvas = (await import("html2canvas")).default;
  // Wait for fonts + images so the first capture isn't blank/half-rendered
  // (the off-screen profile button captures on first click).
  try {
    await (document as any).fonts?.ready;
  } catch {
    /* non-fatal */
  }
  try {
    await waitForImages(el);
  } catch {
    /* non-fatal */
  }
  return html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function exportReportImage(el: HTMLElement, type: "png" | "jpeg", fileBase: string) {
  const canvas = await captureCanvas(el);
  const mime = type === "png" ? "image/png" : "image/jpeg";
  const data = canvas.toDataURL(mime, 0.95);
  triggerDownload(data, `${fileBase}.${type === "jpeg" ? "jpg" : "png"}`);
}

export async function exportReportPdf(el: HTMLElement, fileBase: string) {
  const { jsPDF } = await import("jspdf");
  const canvas = await captureCanvas(el);
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  // The ARK Report is a multi-page (A4-proportioned) sheet. Render the capture
  // at full page width and slice it across as many A4 pages as its height needs.
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;
  while (heightLeft > 0.5) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }
  pdf.save(`${fileBase}.pdf`);
}
