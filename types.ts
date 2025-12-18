export interface TaxPayerInfo {
  name: string;
  address: string;
  taxId: string;
  location: string; // Địa điểm kinh doanh
  period: string; // Kỳ kê khai (tháng/quý/năm)
}

export interface Transaction {
  id: string;
  date: string; // DD/MM/YYYY
  description: string; // Nội dung nghiệp vụ
  amount: number; // Số tiền VND
}

export interface S1aFormState {
  info: TaxPayerInfo;
  transactions: Transaction[];
}

export enum AppView {
  EDIT = 'EDIT',
  PREVIEW = 'PREVIEW',
}