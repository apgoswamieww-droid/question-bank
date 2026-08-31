export function openPrintWindow(htmlContent: string): void {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("Pop-up blocked. Please allow pop-ups for print/PDF.");
    return;
  }
  win.document.write(htmlContent);
  win.document.close();
  win.document.fonts?.ready?.then(() => {
    win.print();
  });
}