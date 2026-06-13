// src/components/ui/SmallButton.tsx

import "./ui.css";

type Props = {
  label: string;
  primary?: boolean;
  onClick?: () => void;
};

export default function SmallButton({
  label,
  primary = false,
  onClick,
}: Props) {
  return (
    <button
      onClick={onClick}
      className={`smallButton ${primary ? "smallButtonPrimary" : ""}`}
    >
      {label}
    </button>
  );
}