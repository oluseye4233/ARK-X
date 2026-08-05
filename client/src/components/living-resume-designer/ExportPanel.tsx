import { Download, FileText, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HonestyGateReview } from "./HonestyGateReview";
import { downloadLivingResumeHtml, exportLivingResumePdf, downloadExportCertificate } from "@/lib/livingResumeExport";
import type { LivingResumeDraft, LivingResumePrefill } from "./types";

interface Props {
  draft: LivingResumeDraft;
  prefill: LivingResumePrefill | null;
  onExported: () => void;
}

export function ExportPanel({ draft, prefill, onExported }: Props) {
  return (
    <div className="space-y-5" data-testid="export-panel">
      <HonestyGateReview draft={draft} prefill={prefill} />

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => {
            downloadLivingResumeHtml(draft, prefill);
            onExported();
          }}
          data-testid="button-export-html"
        >
          <Download className="h-4 w-4 mr-1.5" />
          Generate &amp; Download (HTML)
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            exportLivingResumePdf(draft, prefill);
            onExported();
          }}
          data-testid="button-export-pdf"
        >
          <FileText className="h-4 w-4 mr-1.5" />
          Create PDF with Links
        </Button>
        <Button
          variant="outline"
          onClick={() => downloadExportCertificate(draft, prefill)}
          data-testid="button-export-certificate"
        >
          <FileJson className="h-4 w-4 mr-1.5" />
          SPARTAN Export Certificate
        </Button>
      </div>
    </div>
  );
}
