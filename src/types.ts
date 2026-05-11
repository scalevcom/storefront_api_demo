export interface ApiDiagnostics {
  directUsable: boolean;
  message: string;
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  requestId?: string | null;
}

export interface CollectionResponse<T> {
  data: T[];
  is_paginated?: boolean;
  has_next?: boolean;
  has_previous?: boolean;
  next_cursor?: string | null;
  previous_cursor?: string | null;
  page_size?: number;
}

export interface ProductVariant {
  id: number;
  fullname?: string;
  sku?: string | null;
  option1_value?: string | null;
  option2_value?: string | null;
  option3_value?: string | null;
  price?: string;
  currency?: string;
  images?: string[];
  stock_status?: string;
  item_type?: string;
  description?: string | null;
  weight?: number;
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  entity_type?: "product" | "bundle_price_option" | string;
  description?: string | null;
  rich_description?: string | null;
  bpo_name?: string;
  bundle_id?: number;
  bundle_name?: string;
  bundle_price_option_id?: number;
  bundle_price_option_name?: string;
  price?: string;
  weight_bump?: number | null;
  meta_thumbnail?: string | null;
  item_type?: string;
  is_multiple?: boolean;
  in_stock?: boolean;
  price_range?: {
    min?: string;
    max?: string;
  };
  images?: string[];
  taxonomy?: {
    id?: number;
    name?: string;
    full_path?: string;
  } | null;
  variants?: ProductVariant[];
  bundlelines?: Array<{
    variant_id?: number;
    quantity?: number;
    variant_name?: string;
    product_name?: string;
  }>;
}

export interface Category {
  id: number;
  name: string;
  full_path?: string;
}

export interface LocationOption {
  id: number;
  ro_subdistrict_id?: number;
  subdistrict_name: string;
  ro_city_id?: number;
  city_name: string;
  ro_province_id?: number;
  province_name: string;
  display: string;
  [key: string]: unknown;
}

export interface PostalCodeOption {
  id: number | string;
  postal_code: string;
}

export interface ProvinceOption {
  province_id?: number;
  ro_province_id?: number;
  province_name: string;
}

export interface CityOption {
  city_id?: number;
  ro_city_id?: number;
  city_name: string;
}

export interface PaymentMethod {
  code: string;
  enabled?: boolean;
  label?: string;
  requires_redirect?: boolean;
  [key: string]: unknown;
}

export interface CartItem {
  id: number | string;
  type?: string;
  quantity: number;
  variant_id?: number | string;
  bundle_price_option_id?: number | string;
  bundle_price_option_name?: string;
  bundle_name?: string;
  line_subtotal?: string;
  variant?: ProductVariant & {
    product?: Product;
  };
  product?: Product;
  subtotal?: string;
  total?: string;
  [key: string]: unknown;
}

export interface Cart {
  id?: number | string;
  status?: string;
  item_count?: number;
  total?: string;
  expires_at?: string;
  items?: CartItem[];
  [key: string]: unknown;
}

export interface FlowLog {
  at: string;
  label: string;
  status: "ok" | "warn" | "error";
  detail: string;
}
