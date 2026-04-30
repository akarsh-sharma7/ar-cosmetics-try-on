export enum ProductType {
  LIPSTICK = 'Lipstick',
  BLUSH = 'Blush',
  EYESHADOW = 'Eyeshadow',
  FOUNDATION = 'Foundation',
  EYEBROW = 'Eyebrow',
}

export enum LipstickFinish {
  MATTE = 'Matte',
  LIQUID_MATTE = 'Liquid Matte',
  GLOSSY = 'Glossy',
  CREAM_SATIN = 'Cream/Satin',
  SHEER_BALM = 'Sheer/Balm',
  METALLIC = 'Metallic',
}

export interface Color {
  name: string;
  hex: string;
}

export interface Product {
  id: number;
  name: string;
  brand: string;
  description: string;
  price: number;
  rating: number;
  reviews: number;
  image: string;
  type: ProductType;
  category: string;
  colors: Color[];
  finish?: LipstickFinish;
}
