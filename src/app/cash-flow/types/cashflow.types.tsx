
type Movement = {
  id: string;
  date: string;
  description: string;
  direction: "income" | "expense";
  category: string;
  amount: number;
  status: string;
  sourceType: string;
};

type MonthlySummary = {
  month: string;
  startingBalance: number;
  income: number;
  costs: number;
  netMovement: number;
  endingBalance: number;
};

type ChartItem = {
  label: string;
  balance: number;
};

type CashFlowData = {
  currentBalance: number;
  minimumThreshold: number;
  lowestBalance: number;
  range?: {
    startDate: string;
    months: number;
  };
  monthlySummary: MonthlySummary[];
  movements: Movement[];
  chart: ChartItem[];
};