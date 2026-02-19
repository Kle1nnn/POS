export interface Product {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  image: string;
  category: string;
  sizes?: string[];
  hasExtraToppings?: boolean;
  hasSauceOptions?: boolean;
}
