import { api } from "./api";

export interface GstBuyer {
  gstin: string;
  name: string;
  flatDoorNo: string;
  building?: string;
  streetLocality: string;
  city: string;
  state: string;
  pincode: string;
  phone?: string;
  email?: string;
}

export const GST_STATES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman and Diu",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
};

export const emptyGstBuyer = (): GstBuyer => ({
  gstin: "",
  name: "",
  flatDoorNo: "",
  building: "",
  streetLocality: "",
  city: "",
  state: "",
  pincode: "",
  phone: "",
  email: "",
});
export const normalizeGstin = (value: string) => value.trim().toUpperCase();
export const isValidGstin = (value: string) => {
  const gstin = normalizeGstin(value);
  return (
    Boolean(GST_STATES[gstin.slice(0, 2)]) &&
    /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(gstin)
  );
};
export const validateGstBuyer = (buyer: GstBuyer): string | null => {
  if (!isValidGstin(buyer.gstin)) return "Enter a valid 15-character GSTIN.";
  if (
    !buyer.name.trim() ||
    !buyer.flatDoorNo.trim() ||
    !buyer.streetLocality.trim() ||
    !buyer.city.trim()
  )
    return "Enter the purchaser name and full address.";
  if (buyer.state !== GST_STATES[buyer.gstin.slice(0, 2)])
    return "Purchaser state must match the GSTIN state code.";
  if (!/^\d{6}$/.test(buyer.pincode.trim())) return "Enter a six-digit pincode.";
  if (buyer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email)) return "Enter a valid email.";
  return null;
};

export const gstBuyerApi = {
  search: (search: string) =>
    api.get<unknown, { data: GstBuyer[] }>("/pos/gst-buyers", { params: { search } }),
};
