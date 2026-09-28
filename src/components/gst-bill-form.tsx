import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GST_STATES, gstBuyerApi, type GstBuyer } from "@/lib/gst-billing";

export function GstBillForm({
  buyer,
  onChange,
  disabled = false,
}: {
  buyer: GstBuyer;
  onChange: (buyer: GstBuyer) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const profiles = useQuery({
    queryKey: ["gst-buyers", search.trim()],
    queryFn: () => gstBuyerApi.search(search.trim()),
    enabled: search.trim().length >= 3,
    staleTime: 30_000,
  });
  const set = (key: keyof GstBuyer, value: string) => onChange({ ...buyer, [key]: value });
  const stateName = GST_STATES[buyer.gstin.slice(0, 2)];
  const fields: Array<[keyof GstBuyer, string, boolean]> = [
    ["name", "Customer / firm name", true],
    ["flatDoorNo", "Flat / door no.", true],
    ["building", "Building / wing / sector", false],
    ["streetLocality", "Street / area / locality", true],
    ["city", "City", true],
    ["pincode", "Pincode", true],
    ["phone", "Contact number", false],
    ["email", "Email ID", false],
  ];
  return (
    <div className="mt-3 rounded-xl border-2 bg-card p-4">
      <div className="font-extrabold">GST Bill purchaser details</div>
      <label className="mt-3 block text-sm font-bold">
        Find saved buyer by GSTIN or phone
        <input
          aria-label="Find saved GST buyer"
          value={search}
          disabled={disabled}
          onChange={(event) => setSearch(event.target.value)}
          className="mt-1 w-full rounded-lg border p-2"
          placeholder="Search GSTIN or phone"
        />
      </label>
      {profiles.data?.data?.length ? (
        <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border">
          {profiles.data.data.map((profile) => (
            <button
              type="button"
              key={profile.gstin}
              disabled={disabled}
              onClick={() => {
                onChange(profile);
                setSearch("");
              }}
              className="block w-full border-b px-2 py-2 text-left text-sm hover:bg-secondary"
            >
              {profile.name} · {profile.gstin}
              {profile.phone ? ` · ${profile.phone}` : ""}
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Customer GSTIN *
          <input
            aria-label="Customer GSTIN"
            value={buyer.gstin}
            maxLength={15}
            disabled={disabled}
            onChange={(event) => {
              const gstin = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
              onChange({ ...buyer, gstin, state: GST_STATES[gstin.slice(0, 2)] || "" });
            }}
            className="mt-1 w-full rounded-lg border p-2 uppercase"
          />
        </label>
        <label className="text-sm font-bold">
          PAN (from GSTIN)
          <input
            aria-label="PAN from GSTIN"
            value={buyer.gstin.length >= 12 ? buyer.gstin.slice(2, 12) : ""}
            readOnly
            className="mt-1 w-full rounded-lg border bg-secondary p-2"
          />
        </label>
        {fields.map(([key, label, required]) => (
          <label key={key} className="text-sm font-bold">
            {label}
            {required ? " *" : ""}
            <input
              aria-label={label}
              value={buyer[key] || ""}
              disabled={disabled}
              maxLength={key === "pincode" ? 6 : 200}
              onChange={(event) => set(key, event.target.value)}
              className="mt-1 w-full rounded-lg border p-2"
            />
          </label>
        ))}
        <label className="text-sm font-bold">
          State *
          <input
            aria-label="State"
            value={stateName || buyer.state}
            readOnly
            className="mt-1 w-full rounded-lg border bg-secondary p-2"
          />
        </label>
      </div>
    </div>
  );
}
