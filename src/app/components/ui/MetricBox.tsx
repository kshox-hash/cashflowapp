// src/components/ui/MetricBox.tsx

import AppCard from "./AppCard";
import "./ui.css";

type Props = {
  title: string;
  value: string;
  subtitle?: string;
  accent?: "blue" | "green" | "red" | "amber";
};

export default function MetricBox({ title, value, subtitle, accent }: Props) {
  return (
    <AppCard>
      <div className="metricBox">
        <p className="metricTitle">{title}</p>
        <h2 className={accent ? `metricValue ${accent}` : "metricValue"}>
          {value}
        </h2>
        {subtitle && <p className="metricSubtitle">{subtitle}</p>}
      </div>
    </AppCard>
  );
}