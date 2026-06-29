// CHHOTA BAZAAR mock catalog & operational data.
// Realistic Indian grocery SKUs, prices in INR, areas in metro India.

export type Category = {
  id: string;
  name: string;
  emoji: string;
  color: string;
};

export type Product = {
  id: string;
  name: string;
  brand?: string;
  weight: string;
  mrp: number;
  price: number;
  category: string;
  emoji: string;
  stock: number;
  barcode: string;
};

export const CATEGORIES: Category[] = [
  { id: "fruits-veg", name: "Fruits & Vegetables", emoji: "🥬", color: "#5FAE3E" },
  { id: "dairy", name: "Dairy", emoji: "🥛", color: "#052B7B" },
  { id: "bakery", name: "Bakery", emoji: "🍞", color: "#FF7A00" },
  { id: "beverages", name: "Beverages", emoji: "🥤", color: "#E1261C" },
  { id: "snacks", name: "Snacks", emoji: "🍪", color: "#FFC928" },
  { id: "household", name: "Household", emoji: "🧼", color: "#052B7B" },
  { id: "personal-care", name: "Personal Care", emoji: "🧴", color: "#FF7A00" },
  { id: "frozen", name: "Frozen", emoji: "❄️", color: "#5FAE3E" },
];

export const PRODUCTS: Product[] = [
  // Fruits & Veg
  {
    id: "p1",
    name: "Banana Robusta",
    weight: "1 dozen",
    mrp: 60,
    price: 49,
    category: "fruits-veg",
    emoji: "🍌",
    stock: 42,
    barcode: "8901001000011",
  },
  {
    id: "p2",
    name: "Tomato Local",
    weight: "1 kg",
    mrp: 40,
    price: 32,
    category: "fruits-veg",
    emoji: "🍅",
    stock: 28,
    barcode: "8901001000028",
  },
  {
    id: "p3",
    name: "Onion",
    weight: "1 kg",
    mrp: 45,
    price: 38,
    category: "fruits-veg",
    emoji: "🧅",
    stock: 65,
    barcode: "8901001000035",
  },
  {
    id: "p4",
    name: "Potato",
    weight: "1 kg",
    mrp: 35,
    price: 28,
    category: "fruits-veg",
    emoji: "🥔",
    stock: 80,
    barcode: "8901001000042",
  },
  {
    id: "p5",
    name: "Apple Shimla",
    weight: "1 kg",
    mrp: 220,
    price: 179,
    category: "fruits-veg",
    emoji: "🍎",
    stock: 18,
    barcode: "8901001000059",
  },
  {
    id: "p6",
    name: "Carrot",
    weight: "500 g",
    mrp: 30,
    price: 25,
    category: "fruits-veg",
    emoji: "🥕",
    stock: 22,
    barcode: "8901001000066",
  },
  // Dairy
  {
    id: "p7",
    name: "Amul Gold Milk",
    brand: "Amul",
    weight: "1 L",
    mrp: 68,
    price: 68,
    category: "dairy",
    emoji: "🥛",
    stock: 54,
    barcode: "8901001100011",
  },
  {
    id: "p8",
    name: "Amul Butter",
    brand: "Amul",
    weight: "500 g",
    mrp: 285,
    price: 269,
    category: "dairy",
    emoji: "🧈",
    stock: 16,
    barcode: "8901001100028",
  },
  {
    id: "p9",
    name: "Mother Dairy Curd",
    brand: "Mother Dairy",
    weight: "400 g",
    mrp: 50,
    price: 45,
    category: "dairy",
    emoji: "🍶",
    stock: 32,
    barcode: "8901001100035",
  },
  {
    id: "p10",
    name: "Amul Cheese Slices",
    brand: "Amul",
    weight: "200 g",
    mrp: 140,
    price: 129,
    category: "dairy",
    emoji: "🧀",
    stock: 12,
    barcode: "8901001100042",
  },
  {
    id: "p11",
    name: "Paneer Fresh",
    weight: "200 g",
    mrp: 110,
    price: 95,
    category: "dairy",
    emoji: "🟨",
    stock: 9,
    barcode: "8901001100059",
  },
  // Bakery
  {
    id: "p12",
    name: "Britannia Bread",
    brand: "Britannia",
    weight: "400 g",
    mrp: 45,
    price: 42,
    category: "bakery",
    emoji: "🍞",
    stock: 24,
    barcode: "8901001200011",
  },
  {
    id: "p13",
    name: "Brown Bread",
    brand: "Modern",
    weight: "400 g",
    mrp: 55,
    price: 49,
    category: "bakery",
    emoji: "🥖",
    stock: 14,
    barcode: "8901001200028",
  },
  {
    id: "p14",
    name: "Pav Buns",
    weight: "12 pcs",
    mrp: 40,
    price: 35,
    category: "bakery",
    emoji: "🥯",
    stock: 18,
    barcode: "8901001200035",
  },
  // Beverages
  {
    id: "p15",
    name: "Coca Cola",
    brand: "Coca-Cola",
    weight: "750 ml",
    mrp: 45,
    price: 40,
    category: "beverages",
    emoji: "🥤",
    stock: 60,
    barcode: "8901001300011",
  },
  {
    id: "p16",
    name: "Thums Up",
    brand: "Coca-Cola",
    weight: "750 ml",
    mrp: 45,
    price: 40,
    category: "beverages",
    emoji: "🥤",
    stock: 48,
    barcode: "8901001300028",
  },
  {
    id: "p17",
    name: "Real Mixed Fruit",
    brand: "Real",
    weight: "1 L",
    mrp: 140,
    price: 119,
    category: "beverages",
    emoji: "🧃",
    stock: 22,
    barcode: "8901001300035",
  },
  {
    id: "p18",
    name: "Bisleri Water",
    brand: "Bisleri",
    weight: "1 L",
    mrp: 25,
    price: 20,
    category: "beverages",
    emoji: "💧",
    stock: 95,
    barcode: "8901001300042",
  },
  // Snacks
  {
    id: "p19",
    name: "Lays Classic Salted",
    brand: "Lays",
    weight: "52 g",
    mrp: 20,
    price: 20,
    category: "snacks",
    emoji: "🥔",
    stock: 78,
    barcode: "8901001400011",
  },
  {
    id: "p20",
    name: "Kurkure Masala Munch",
    brand: "Kurkure",
    weight: "85 g",
    mrp: 20,
    price: 20,
    category: "snacks",
    emoji: "🌽",
    stock: 64,
    barcode: "8901001400028",
  },
  {
    id: "p21",
    name: "Parle-G Biscuits",
    brand: "Parle",
    weight: "250 g",
    mrp: 30,
    price: 28,
    category: "snacks",
    emoji: "🍪",
    stock: 88,
    barcode: "8901001400035",
  },
  {
    id: "p22",
    name: "Haldiram Bhujia",
    brand: "Haldiram",
    weight: "200 g",
    mrp: 75,
    price: 69,
    category: "snacks",
    emoji: "🥨",
    stock: 26,
    barcode: "8901001400042",
  },
  // Household
  {
    id: "p23",
    name: "Surf Excel Powder",
    brand: "Surf Excel",
    weight: "1 kg",
    mrp: 240,
    price: 215,
    category: "household",
    emoji: "🧺",
    stock: 18,
    barcode: "8901001500011",
  },
  {
    id: "p24",
    name: "Vim Dishwash Bar",
    brand: "Vim",
    weight: "300 g",
    mrp: 30,
    price: 27,
    category: "household",
    emoji: "🧼",
    stock: 42,
    barcode: "8901001500028",
  },
  {
    id: "p25",
    name: "Harpic Toilet Cleaner",
    brand: "Harpic",
    weight: "1 L",
    mrp: 195,
    price: 169,
    category: "household",
    emoji: "🚽",
    stock: 16,
    barcode: "8901001500035",
  },
  // Personal Care
  {
    id: "p26",
    name: "Colgate MaxFresh",
    brand: "Colgate",
    weight: "150 g",
    mrp: 110,
    price: 95,
    category: "personal-care",
    emoji: "🪥",
    stock: 32,
    barcode: "8901001600011",
  },
  {
    id: "p27",
    name: "Dove Soap",
    brand: "Dove",
    weight: "100 g",
    mrp: 75,
    price: 65,
    category: "personal-care",
    emoji: "🧴",
    stock: 44,
    barcode: "8901001600028",
  },
  {
    id: "p28",
    name: "Head & Shoulders Shampoo",
    brand: "H&S",
    weight: "340 ml",
    mrp: 410,
    price: 355,
    category: "personal-care",
    emoji: "🧴",
    stock: 12,
    barcode: "8901001600035",
  },
  // Frozen
  {
    id: "p29",
    name: "McCain French Fries",
    brand: "McCain",
    weight: "750 g",
    mrp: 199,
    price: 169,
    category: "frozen",
    emoji: "🍟",
    stock: 14,
    barcode: "8901001700011",
  },
  {
    id: "p30",
    name: "Amul Vanilla Ice Cream",
    brand: "Amul",
    weight: "1 L",
    mrp: 220,
    price: 189,
    category: "frozen",
    emoji: "🍨",
    stock: 8,
    barcode: "8901001700028",
  },
];

export type Customer = {
  id: string;
  name: string;
  mobile: string;
  area: string;
  pincode: string;
  address?: string;
  orders: number;
  spend: number;
  loyalty: number;
};

export const CUSTOMERS: Customer[] = [
  {
    id: "c1",
    name: "Ramesh Kumar",
    mobile: "9876543210",
    area: "Karol Bagh",
    pincode: "110005",
    address: "12/4, Pusa Road",
    orders: 47,
    spend: 28640,
    loyalty: 286,
  },
  {
    id: "c2",
    name: "Priya Sharma",
    mobile: "9811223344",
    area: "Lajpat Nagar",
    pincode: "110024",
    address: "B-32, Central Market",
    orders: 32,
    spend: 19250,
    loyalty: 192,
  },
  {
    id: "c3",
    name: "Mohammed Aslam",
    mobile: "9818765432",
    area: "Jamia Nagar",
    pincode: "110025",
    address: "House 88, Batla House",
    orders: 68,
    spend: 41200,
    loyalty: 412,
  },
  {
    id: "c4",
    name: "Sunita Devi",
    mobile: "9999887766",
    area: "Rohini Sec 7",
    pincode: "110085",
    address: "Plot 14, Pocket A",
    orders: 21,
    spend: 12480,
    loyalty: 124,
  },
  {
    id: "c5",
    name: "Arjun Mehta",
    mobile: "9871122334",
    area: "Saket",
    pincode: "110017",
    address: "D-204, Saket Apts",
    orders: 15,
    spend: 8920,
    loyalty: 89,
  },
];

export type Rider = {
  id: string;
  name: string;
  active: number;
  available: boolean;
  distance: string;
  initial: string;
};

export const RIDERS: Rider[] = [
  { id: "r1", name: "Sonu Yadav", active: 2, available: true, distance: "0.4 km", initial: "SY" },
  { id: "r2", name: "Vikram Singh", active: 0, available: true, distance: "1.2 km", initial: "VS" },
  { id: "r3", name: "Rahul Verma", active: 3, available: false, distance: "2.1 km", initial: "RV" },
  { id: "r4", name: "Aman Khan", active: 1, available: true, distance: "0.8 km", initial: "AK" },
];

export type HeldOrder = {
  id: string;
  customer: string;
  items: number;
  value: number;
  createdAt: string;
};

export const HELD_ORDERS: HeldOrder[] = [
  { id: "H1042", customer: "Walk-in", items: 6, value: 412, createdAt: "11:42 AM" },
  { id: "H1043", customer: "Ramesh Kumar", items: 12, value: 1264, createdAt: "11:58 AM" },
  { id: "H1044", customer: "Walk-in", items: 3, value: 187, createdAt: "12:14 PM" },
];

export type Transaction = {
  id: string;
  time: string;
  customer: string;
  items: number;
  amount: number;
  mode: "Cash" | "UPI" | "Card" | "Wallet" | "Split";
  type: "Walk-in" | "Delivery" | "Pickup";
};

export const RECENT_TX: Transaction[] = [
  {
    id: "CB-24189",
    time: "12:42 PM",
    customer: "Priya Sharma",
    items: 14,
    amount: 1842,
    mode: "UPI",
    type: "Delivery",
  },
  {
    id: "CB-24188",
    time: "12:38 PM",
    customer: "Walk-in",
    items: 4,
    amount: 268,
    mode: "Cash",
    type: "Walk-in",
  },
  {
    id: "CB-24187",
    time: "12:31 PM",
    customer: "Mohammed Aslam",
    items: 22,
    amount: 3124,
    mode: "Card",
    type: "Delivery",
  },
  {
    id: "CB-24186",
    time: "12:24 PM",
    customer: "Walk-in",
    items: 2,
    amount: 89,
    mode: "Cash",
    type: "Walk-in",
  },
  {
    id: "CB-24185",
    time: "12:19 PM",
    customer: "Sunita Devi",
    items: 9,
    amount: 742,
    mode: "UPI",
    type: "Pickup",
  },
  {
    id: "CB-24184",
    time: "12:11 PM",
    customer: "Arjun Mehta",
    items: 6,
    amount: 489,
    mode: "Wallet",
    type: "Walk-in",
  },
];

export type DeliveryOrder = {
  id: string;
  customer: string;
  area: string;
  amount: number;
  eta: string;
  status: "unassigned" | "assigned" | "out";
};

export const DELIVERY_QUEUE: DeliveryOrder[] = [
  {
    id: "CB-24189",
    customer: "Priya Sharma",
    area: "Lajpat Nagar",
    amount: 1842,
    eta: "25 min",
    status: "unassigned",
  },
  {
    id: "CB-24187",
    customer: "Mohammed Aslam",
    area: "Jamia Nagar",
    amount: 3124,
    eta: "32 min",
    status: "unassigned",
  },
  {
    id: "CB-24182",
    customer: "Ramesh Kumar",
    area: "Karol Bagh",
    amount: 956,
    eta: "18 min",
    status: "assigned",
  },
  {
    id: "CB-24180",
    customer: "Neha Gupta",
    area: "Saket",
    amount: 2210,
    eta: "40 min",
    status: "unassigned",
  },
];

export const formatINR = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
