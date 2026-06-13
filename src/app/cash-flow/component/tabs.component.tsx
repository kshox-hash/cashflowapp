export default function Tabs({
  selectedTab,
  onChange,
}: {
  selectedTab: 0 | 1 | 2;
  onChange: (value: 0 | 1 | 2) => void;
}) {
  const tabs = ["Resumen", "Movimientos", "Agregar"];

  return (
    <div className="mainTabs">
      {tabs.map((tab, index) => (
        <button
          key={tab}
          className={selectedTab === index ? "active" : ""}
          onClick={() => onChange(index as 0 | 1 | 2)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}