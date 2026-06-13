// src/components/ui/StatusPill.tsx

import "./ui.css";

type PillColor =
  | "blue"
  | "green"
  | "red"
  | "amber";

type Props = {
  label: string;
  color?: PillColor;
};

export default function StatusPill({
  label,
  color = "blue",
}: Props) {
  return (
    <span className={`statusPill ${color}`}>
      {label}
    </span>
  );
}