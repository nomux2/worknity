export interface CatalogConfig {
  id: number;
  show_price: boolean;
  device_label: string;
}

export interface CatalogItem {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  price: number | null;
  image_path: string | null;
  sort_order: number;
  attributes: any;
  created_at?: string;
  updated_at?: string;
}

export interface CatalogCategory {
  id: number;
  name: string;
  sort_order: number;
  items?: CatalogItem[];
  created_at?: string;
  updated_at?: string;
}

export interface Device {
  id: number;
  organization_id: number;
  device_code: string;
  name: string;
  access_token?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  item_id: number;
  item?: CatalogItem;
  quantity: number;
  price: number | null;
}

export interface Order {
  id: number;
  organization_id: number;
  device_id: number;
  device?: Device;
  status: 'ordered' | 'preparing' | 'served';
  total_price: number | null;
  items?: OrderItem[];
  created_at: string;
  updated_at: string;
}
