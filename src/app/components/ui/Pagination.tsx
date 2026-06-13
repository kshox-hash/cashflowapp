type Props = {
  total: number;
  page: number;
  pageSize: number;
  onChange: (page: number) => void;
};

export default function Pagination({ total, page, pageSize, onChange }: Props) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <button
        className="paginationBtn"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        ← Anterior
      </button>

      <span className="paginationInfo">
        {start}–{end} de {total} registros
      </span>

      <button
        className="paginationBtn"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
      >
        Siguiente →
      </button>
    </div>
  );
}
