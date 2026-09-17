export type CustomerFormValues = {
  name: string;
  mobile: string;
  address: string;
  area: string;
  pincode: string;
};

export type CustomerFormErrors = Partial<Record<keyof CustomerFormValues, string>>;

export type CustomerCreatePayload = {
  name: string;
  mobile: string;
  address?: string;
  area?: string;
  pincode?: string;
};

export function isCustomerBlocked(status?: string): boolean {
  return status?.trim().toLowerCase() === "blocked";
}

export function validateCustomerForm(form: CustomerFormValues): {
  errors: CustomerFormErrors;
  payload: CustomerCreatePayload | null;
} {
  const name = form.name.trim();
  const mobile = form.mobile.replace(/\D/g, "");
  const address = form.address.trim();
  const area = form.area.trim();
  const pincode = form.pincode.replace(/\D/g, "");
  const errors: CustomerFormErrors = {};

  if (!name) errors.name = "Customer name is required.";
  if (mobile.length !== 10) errors.mobile = "Enter a valid 10 digit mobile number.";
  if (form.pincode.trim() && pincode.length !== 6) {
    errors.pincode = "Enter a valid 6 digit pincode.";
  }

  if (Object.keys(errors).length > 0) return { errors, payload: null };

  return {
    errors,
    payload: {
      name,
      mobile,
      ...(address ? { address } : {}),
      ...(area ? { area } : {}),
      ...(pincode ? { pincode } : {}),
    },
  };
}
