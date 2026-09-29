import { describe, expect, it } from "vitest";
import { GST_STATES, isValidGstin, validateGstBuyer } from "./gst-billing";

const buyer = {
  gstin: "23AFOPS4000B1ZZ",
  name: "Charanjeet Singh",
  flatDoorNo: "111",
  streetLocality: "Maxi Road",
  city: "Ujjain",
  state: "Madhya Pradesh",
  pincode: "456010",
};

describe("GST buyer checkout details", () => {
  it("derives a valid state and PAN position from the GSTIN", () => {
    expect(isValidGstin(buyer.gstin)).toBe(true);
    expect(GST_STATES[buyer.gstin.slice(0, 2)]).toBe("Madhya Pradesh");
    expect(buyer.gstin.slice(2, 12)).toBe("AFOPS4000B");
    expect(validateGstBuyer(buyer)).toBeNull();
  });

  it("requires the address and rejects a mismatched state", () => {
    expect(validateGstBuyer({ ...buyer, streetLocality: "" })).toMatch(/full address/);
    expect(validateGstBuyer({ ...buyer, state: "Gujarat" })).toMatch(/match/);
  });
});
