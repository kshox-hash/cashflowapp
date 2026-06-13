// src/components/ui/AppCard.tsx

import "./ui.css";

type Props = {
  children: React.ReactNode;
  height?: number;
  noPadding?: boolean;
};

export default function AppCard({ children, height, noPadding = false }: Props) {
  return (
    <div
      className={`appCard ${noPadding ? "appCardNoPadding" : ""}`}
      style={height ? { height } : undefined}
    >
      {children}
    </div>
  );
}