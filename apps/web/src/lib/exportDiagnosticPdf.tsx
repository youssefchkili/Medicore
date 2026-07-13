import { pdf } from "@react-pdf/renderer";
import { PreDiagnosticPdfDocument, type PdfDiagnostic } from "@/components/diagnostics/PreDiagnosticPdfDocument";

export async function downloadDiagnosticPdf(diag: PdfDiagnostic, patientName: string) {
  const blob = await pdf(
    <PreDiagnosticPdfDocument diag={diag} patientName={patientName} />
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `medicore-report-${diag.id.slice(0, 8)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
