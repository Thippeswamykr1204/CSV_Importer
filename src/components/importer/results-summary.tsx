"use client";

import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Gauge, Timer, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { ImportStats } from "@/lib/types/crm";

interface ResultsSummaryProps {
  stats: ImportStats;
}

export function ResultsSummary({ stats }: ResultsSummaryProps) {
  const cards = [
    {
      label: "Total records",
      value: stats.totalRecords.toLocaleString(),
      icon: ListChecks,
      tone: "text-foreground",
    },
    {
      label: "Imported",
      value: stats.importedRecords.toLocaleString(),
      icon: CheckCircle2,
      tone: "text-success",
    },
    {
      label: "Skipped",
      value: stats.skippedRecords.toLocaleString(),
      icon: XCircle,
      tone: "text-danger",
    },
    {
      label: "Avg. confidence",
      value: `${Math.round(stats.averageConfidence * 100)}%`,
      icon: Gauge,
      tone: "text-accent",
    },
    {
      label: "Processing time",
      value: `${(stats.processingTimeMs / 1000).toFixed(1)}s`,
      icon: Timer,
      tone: "text-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
        >
          <Card className="p-4">
            <card.icon className={`size-4 ${card.tone} mb-2.5`} strokeWidth={1.75} />
            <p className={`text-2xl font-semibold tabular ${card.tone}`}>{card.value}</p>
            <p className="text-[11px] text-muted mt-0.5">{card.label}</p>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
