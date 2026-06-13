// src/components/ui/PageTitle.tsx

import "./ui.css";

type Props = {
  title: string;
  subtitle?: string;
};

export default function PageTitle({ title, subtitle }: Props) {
  return (
    <div className="pageTitle">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}