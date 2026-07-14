"use client";

import { Download } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { UPLOAD_LIMITS_LABEL } from "@/lib/utils/csv-client";

interface HelpPanelProps {
  open: boolean;
  onClose: () => void;
}

const FAQ = [
  {
    q: "What file types are supported?",
    a: `CSV files only (${UPLOAD_LIMITS_LABEL}). Excel/Sheets exports work fine as long as they're saved or exported as .csv first — or use "Import from Google Sheets" to skip that step entirely.`,
  },
  {
    q: "Do I need to map columns myself?",
    a: "No. The AI infers what each column means from its content, not its header text — so \"Phone\", \"Mobile\", \"WhatsApp\", and \"Contact Number\" all resolve to the same field automatically.",
  },
  {
    q: "What does \"skipped\" mean in my results?",
    a: "A row is skipped when it has neither an email nor a phone number — GrowEasy CRM requires at least one to create a lead. Skipped rows can be corrected inline on the results screen instead of being lost.",
  },
  {
    q: "Why did some rows fail and how do I fix them?",
    a: 'Rows can fail if the AI service has a transient error on a batch. These are distinct from business-rule skips and show a "Retry failed rows" button on the results screen — one click resubmits just those rows.',
  },
  {
    q: "Is my data stored anywhere?",
    a: "No. The import pipeline is fully stateless — nothing is written to a database or disk server-side. Import History (if you've used it) only stores aggregate counts in your browser's local storage, never the actual imported records.",
  },
  {
    q: "What does the confidence score mean?",
    a: "Each imported row gets a 0–100% confidence score reflecting how certain the AI is about that row's mapping as a whole. Use the confidence filter on the results screen to quickly find rows worth a manual glance.",
  },
];

export function HelpPanel({ open, onClose }: HelpPanelProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Help"
      description="Common questions about importing with GrowEasy."
      widthClassName="max-w-lg"
    >
      <div className="space-y-4">
        {FAQ.map((item) => (
          <div key={item.q}>
            <p className="text-[13px] font-medium text-foreground">{item.q}</p>
            <p className="text-[12.5px] text-muted mt-1 leading-relaxed">{item.a}</p>
          </div>
        ))}

        <div className="pt-2 border-t border-border">
          <a
            href="/api/sample-csv"
            download
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:text-accent-hover cursor-pointer"
          >
            <Download className="size-3.5" />
            Download a sample CSV to try it out
          </a>
        </div>
      </div>
    </Modal>
  );
}