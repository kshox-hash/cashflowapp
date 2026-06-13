export default function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`quickChip ${active ? "active" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}
