export type Customer = {
  id: string;
  code: string;
  name: string;
  city: string;
  phone: string;
  email: string;
  address: string;
  note: string;
  active: boolean;
};

export type SalesDispatchItem = {
  packagingId: string;
  quantity: number;
};

export type SalesDispatch = {
  id: string;
  date: string;
  customerId: string;
  note: string;
  items: SalesDispatchItem[];
  updatedAt: string;
};

export type InventoryRow = {
  packagingId: string;
  label: string;
  unitWeightKg: number;
  producedCount: number;
  soldCount: number;
  onHandCount: number;
  onHandKg: number;
};
