"use client";

import React, { useEffect, useState } from "react";
import { useCart } from "@/components/cart/CartContext";

type Measurement = {
  id: number;
  heightCm: number | null;
  chestCm: number | null;
  sleeveLengthCm: number | null;
};

type Address = {
  id: number;
  name: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
  addressType: "shipping" | "billing";
};

type ProfileData = {
  user: {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  measurement: Measurement | null;
  shippingAddresses: Address[];
  billingAddresses: Address[];
};

type MeasurementForm = {
  heightCm: string;
  chestCm: string;
  sleeveLengthCm: string;
};

type AddressForm = {
  name: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
};

type OrderRecord = {
  items: Array<{
    productId: number;
    variantId: number;
    name: string;
    quantity: number;
    unitPriceUsd: number;
    color: string | null;
    size: string | null;
    weightKg: number | null;
    imageUrl: string | null;
    variantExists: boolean;
  }>;
  id: number;
  invoiceNumber: string | null;
  paymentStatus: string;
  shipmentStatus: string;
  subtotalUsd: number;
  shippingUsd: number;
  totalUsd: number;
  paidAt: string | null;
  createdAt: string | null;
};

type ProfileSection = "overview" | "measurements" | "shipping" | "billing" | "orders";
type MeasurementFormErrors = Partial<Record<keyof MeasurementForm, string>>;
type AddressFormErrors = Partial<Record<keyof AddressForm, string>>;
const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

function emptyMeasurementForm(): MeasurementForm {
  return {
    heightCm: "",
    chestCm: "",
    sleeveLengthCm: "",
  };
}

function emptyAddressForm(): AddressForm {
  return {
    name: "",
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "United States",
    phone: "",
  };
}

function measurementToForm(measurement: Measurement): MeasurementForm {
  return {
    heightCm: measurement.heightCm == null ? "" : String(measurement.heightCm),
    chestCm: measurement.chestCm == null ? "" : String(measurement.chestCm),
    sleeveLengthCm: measurement.sleeveLengthCm == null ? "" : String(measurement.sleeveLengthCm),
  };
}

function addressToForm(address: Address): AddressForm {
  return {
    name: address.name,
    street: address.street,
    city: address.city,
    state: address.state,
    zipCode: address.zipCode,
    country: address.country,
    phone: address.phone,
  };
}

function formatName(profile: ProfileData["user"]) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  return fullName || profile.email;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not paid yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatUsPhone(phone: string) {
  const trimmedPhone = phone.trim();
  if (!trimmedPhone) {
    return "";
  }

  return trimmedPhone.startsWith("+1") ? trimmedPhone : `+1 ${trimmedPhone}`;
}

function validateMeasurementForm(): MeasurementFormErrors {
  return {};
}

function validateAddressForm(values: AddressForm): AddressFormErrors {
  const errors: AddressFormErrors = {};

  if (!values.name.trim()) errors.name = "Full name is required.";
  if (!values.phone.trim()) errors.phone = "Phone is required.";
  if (!values.street.trim()) errors.street = "Street is required.";
  if (!values.city.trim()) errors.city = "City is required.";
  if (!values.state.trim()) errors.state = "State is required.";
  if (!values.zipCode.trim()) errors.zipCode = "ZIP code is required.";

  return errors;
}

function AddressCard({
  address,
  onEdit,
  onDelete,
  deleting,
}: {
  address: Address;
  onEdit?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">{address.name}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {address.street}
            <br />
            {address.city}, {address.state} {address.zipCode}
            <br />
            {address.country}
            <br />
            {formatUsPhone(address.phone)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-500 hover:text-zinc-900"
            >
              Edit
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:border-red-300 hover:text-red-700 disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          ) : null}
          {address.isDefault ? (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
              Default
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AddressFormFields({
  values,
  onChange,
  errors,
  formError,
  submitLabel,
  onSubmit,
  saving,
  onCancel,
}: {
  values: AddressForm;
  onChange: (field: keyof AddressForm, value: string) => void;
  errors?: AddressFormErrors;
  formError?: string | null;
  submitLabel: string;
  onSubmit: () => void;
  saving: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-zinc-700">
          Full name
          <input
            value={values.name}
            onChange={(event) => onChange("name", event.target.value)}
            className={`mt-2 w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 ${
              errors?.name ? "border-red-300" : "border-zinc-200"
            }`}
          />
          {errors?.name ? <div className="mt-2 text-xs text-red-600">{errors.name}</div> : null}
        </label>
        <label className="text-sm text-zinc-700">
          Phone
          <div
            className={`mt-2 flex items-center overflow-hidden rounded-2xl border bg-white ${
              errors?.phone ? "border-red-300" : "border-zinc-200"
            }`}
          >
            <div className="border-r border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
              +1
            </div>
            <input
              value={values.phone}
              onChange={(event) => onChange("phone", event.target.value)}
              className="w-full bg-white px-3 py-2 text-sm text-zinc-900 outline-none"
            />
          </div>
          {errors?.phone ? <div className="mt-2 text-xs text-red-600">{errors.phone}</div> : null}
        </label>
        <label className="text-sm text-zinc-700 md:col-span-2">
          Street
          <input
            value={values.street}
            onChange={(event) => onChange("street", event.target.value)}
            className={`mt-2 w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 ${
              errors?.street ? "border-red-300" : "border-zinc-200"
            }`}
          />
          {errors?.street ? <div className="mt-2 text-xs text-red-600">{errors.street}</div> : null}
        </label>
        <label className="text-sm text-zinc-700">
          City
          <input
            value={values.city}
            onChange={(event) => onChange("city", event.target.value)}
            className={`mt-2 w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 ${
              errors?.city ? "border-red-300" : "border-zinc-200"
            }`}
          />
          {errors?.city ? <div className="mt-2 text-xs text-red-600">{errors.city}</div> : null}
        </label>
        <label className="text-sm text-zinc-700">
          State
          <select
            value={values.state}
            onChange={(event) => onChange("state", event.target.value)}
            className={`mt-2 w-full rounded-2xl border bg-white px-3 py-2 text-sm uppercase text-zinc-900 ${
              errors?.state ? "border-red-300" : "border-zinc-200"
            }`}
          >
            <option value="">Select a state</option>
            {US_STATES.map((state) => (
              <option key={state.value} value={state.value}>
                {state.label}
              </option>
            ))}
          </select>
          {errors?.state ? <div className="mt-2 text-xs text-red-600">{errors.state}</div> : null}
        </label>
        <label className="text-sm text-zinc-700">
          ZIP code
          <input
            value={values.zipCode}
            onChange={(event) => onChange("zipCode", event.target.value)}
            className={`mt-2 w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 ${
              errors?.zipCode ? "border-red-300" : "border-zinc-200"
            }`}
          />
          {errors?.zipCode ? <div className="mt-2 text-xs text-red-600">{errors.zipCode}</div> : null}
        </label>
        <label className="text-sm text-zinc-700">
          Country
          <div className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-600">
            United States
          </div>
        </label>
      </div>

      {formError ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className="rounded-full bg-zinc-900 px-5 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {saving ? "Saving..." : submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-zinc-300 px-5 py-2 text-sm text-zinc-700 hover:border-zinc-500 hover:text-zinc-900"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function ProfilePageClient({
  initialSection = "overview",
}: {
  initialSection?: ProfileSection;
}) {
  const { addItem, openCart } = useCart();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [measurementForm, setMeasurementForm] = useState<MeasurementForm>(emptyMeasurementForm());
  const [shippingForms, setShippingForms] = useState<AddressForm[]>([emptyAddressForm(), emptyAddressForm()]);
  const [billingForm, setBillingForm] = useState<AddressForm>(emptyAddressForm());
  const [savingMeasurement, setSavingMeasurement] = useState(false);
  const [savingShippingIndex, setSavingShippingIndex] = useState<number | null>(null);
  const [savingBilling, setSavingBilling] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState<number | null>(null);
  const [measurementErrors, setMeasurementErrors] = useState<MeasurementFormErrors>({});
  const [measurementFormError, setMeasurementFormError] = useState<string | null>(null);
  const [shippingFormErrors, setShippingFormErrors] = useState<AddressFormErrors[]>([{}, {}]);
  const [shippingFormError, setShippingFormError] = useState<string | null>(null);
  const [billingFormErrors, setBillingFormErrors] = useState<AddressFormErrors>({});
  const [billingFormError, setBillingFormError] = useState<string | null>(null);
  const [showSecondShippingForm, setShowSecondShippingForm] = useState(false);
  const [isEditingMeasurement, setIsEditingMeasurement] = useState(false);
  const [editingShippingAddressId, setEditingShippingAddressId] = useState<number | null>(null);
  const [editingBillingAddressId, setEditingBillingAddressId] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<ProfileSection>(initialSection);
  const [showBillingForm, setShowBillingForm] = useState(false);

  function buyOrderItemAgain(item: OrderRecord["items"][number]) {
    addItem({
      id: `${item.productId}-${item.variantId}`,
      name: item.name,
      price: item.unitPriceUsd,
      weightKg: item.weightKg,
      imageUrl: item.imageUrl,
      color: item.color,
      size: item.size,
      qty: item.quantity,
    });
    openCart();
  }

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          if (!cancelled) {
            setError(payload?.error ?? "Unable to load profile.");
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setProfile(payload);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load profile.");
          setLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeSection !== "orders" || ordersLoaded) {
      return;
    }

    let cancelled = false;
    const LOAD_ORDERS_TIMEOUT_MS = 10000;

    async function loadOrders() {
      setOrdersLoading(true);
      setOrdersError(null);

      try {
        const response = await Promise.race([
          fetch("/api/profile/orders", { cache: "no-store" }),
          new Promise<never>((_, reject) => {
            window.setTimeout(() => reject(new Error("Orders request timed out.")), LOAD_ORDERS_TIMEOUT_MS);
          }),
        ]);

        const payload = await response.json().catch(() => null);

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setOrdersError(payload?.error ?? "Unable to load orders.");
          setOrdersLoaded(true);
          setOrdersLoading(false);
          return;
        }

        setOrders(Array.isArray(payload) ? payload : []);
      } catch {
        if (!cancelled) {
          setOrders([]);
          setOrdersError("Unable to load orders.");
        }
      } finally {
        if (!cancelled) {
          setOrdersLoaded(true);
          setOrdersLoading(false);
        }
      }
    }

    void loadOrders();

    return () => {
      cancelled = true;
    };
  }, [activeSection, ordersLoaded]);

  const nextShippingFormIndex =
    profile?.shippingAddresses.length === 0
      ? 0
      : profile?.shippingAddresses.length === 1 && showSecondShippingForm
        ? 1
        : null;

  async function saveMeasurementForm() {
    const validationErrors = validateMeasurementForm(measurementForm);
    if (Object.keys(validationErrors).length > 0) {
      setMeasurementErrors(validationErrors);
      setMeasurementFormError(null);
      return;
    }

    setSavingMeasurement(true);
    setError(null);
    setMeasurementErrors({});
    setMeasurementFormError(null);

    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: "measurement",
        measurement: measurementForm,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setMeasurementFormError(payload?.error ?? "Unable to save measurement.");
      setSavingMeasurement(false);
      return;
    }

    setProfile(payload);
    setMeasurementForm(emptyMeasurementForm());
    setMeasurementErrors({});
    setMeasurementFormError(null);
    setIsEditingMeasurement(false);
    setSavingMeasurement(false);
  }

  async function saveAddressForm(
    addressType: "shipping" | "billing",
    form: AddressForm,
    index?: number,
    addressId?: number
  ) {
    const validationErrors = validateAddressForm(form);
    if (Object.keys(validationErrors).length > 0) {
      if (addressType === "shipping" && typeof index === "number") {
        setShippingFormErrors((current) => current.map((item, itemIndex) => (
          itemIndex === index ? validationErrors : item
        )));
        setShippingFormError(null);
      } else {
        setBillingFormErrors(validationErrors);
        setBillingFormError(null);
      }
      return;
    }

    if (addressType === "shipping" && typeof index === "number") {
      setSavingShippingIndex(index);
      setShippingFormErrors((current) => current.map((item, itemIndex) => (
        itemIndex === index ? {} : item
      )));
      setShippingFormError(null);
    } else {
      setSavingBilling(true);
      setBillingFormErrors({});
      setBillingFormError(null);
    }
    setError(null);

    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section: "address",
        addressType,
        addressId,
        address: form,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (addressType === "shipping") {
        setShippingFormError(payload?.error ?? "Unable to save address.");
      } else {
        setBillingFormError(payload?.error ?? "Unable to save address.");
      }
      setSavingShippingIndex(null);
      setSavingBilling(false);
      return;
    }

    setProfile(payload);
    if (addressType === "shipping" && typeof index === "number") {
      setShippingForms((current) => current.map((item, itemIndex) => (
        itemIndex === index ? emptyAddressForm() : item
      )));
      setShippingFormErrors((current) => current.map((item, itemIndex) => (
        itemIndex === index ? {} : item
      )));
      setShippingFormError(null);
      setShowSecondShippingForm(false);
      setEditingShippingAddressId(null);
      setSavingShippingIndex(null);
    } else {
      setBillingForm(emptyAddressForm());
      setBillingFormErrors({});
      setBillingFormError(null);
      setEditingBillingAddressId(null);
      setSavingBilling(false);
    }
  }

  async function deleteSavedAddress(addressId: number) {
    setDeletingAddressId(addressId);
    setError(null);

    const response = await fetch("/api/profile", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addressId }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error ?? "Unable to delete address.");
      setDeletingAddressId(null);
      return;
    }

    setProfile(payload);
    setDeletingAddressId(null);
    setEditingShippingAddressId((current) => (current === addressId ? null : current));
    setEditingBillingAddressId((current) => (current === addressId ? null : current));
    setShowSecondShippingForm(false);
    setShowBillingForm(false);
  }

  async function useShippingAsBilling() {
    setSavingBilling(true);
    setBillingFormError(null);
    setError(null);

    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: "billing-from-shipping" }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setBillingFormError(payload?.error ?? "Unable to use shipping address as billing.");
      setSavingBilling(false);
      return;
    }

    setProfile(payload);
    setShowBillingForm(false);
    setSavingBilling(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            Loading profile...
          </div>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700 sm:p-8">
            {error ?? "Unable to load profile."}
          </div>
        </div>
      </main>
    );
  }

  const navigationItems: Array<{ id: ProfileSection; label: string; detail: string }> = [
    { id: "overview", label: "Profile", detail: "Name and account email" },
    { id: "orders", label: "Orders", detail: "Past purchases and invoices" },
    { id: "measurements", label: "Measurements", detail: "Body sizing and fit data" },
    { id: "shipping", label: "Shipping Addresses", detail: "Up to two delivery addresses" },
    { id: "billing", label: "Billing Addresses", detail: "Payment and invoice addresses" },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900 sm:px-6 sm:py-16">
      <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-sm">
            <nav className="space-y-2">
              {navigationItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full rounded-2xl px-4 py-4 text-left transition ${
                    activeSection === item.id
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div
                    className={`mt-1 text-xs ${
                      activeSection === item.id ? "text-zinc-300" : "text-zinc-500"
                    }`}
                  >
                    {item.detail}
                  </div>
                </button>
              ))}
            </nav>
          </aside>

          {activeSection === "overview" ? (
            <section className="rounded-[2rem] border border-zinc-200 bg-white px-5 py-5 shadow-sm sm:px-8 sm:py-6">
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Profile</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">{formatName(profile.user)}</h1>
              <p className="mt-1 text-sm text-zinc-600">{profile.user.email}</p>
            </section>
          ) : null}

          {activeSection === "orders" ? (
            <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
              <h2 className="text-2xl font-semibold tracking-tight">Orders</h2>
              <p className="mt-2 text-sm text-zinc-600">
                Review the orders and invoice numbers saved to your account.
              </p>

              {ordersLoading ? (
                <div className="mt-6 rounded-3xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600">
                  Loading orders...
                </div>
              ) : ordersError ? (
                <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                  {ordersError}
                </div>
              ) : orders.length === 0 ? (
                <div className="mt-6 rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
                  No orders yet.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm text-zinc-500">
                            {order.invoiceNumber ?? `Order #${order.id}`}
                          </div>
                          <div className="mt-2 text-base font-semibold text-zinc-900">
                            {formatDateTime(order.paidAt ?? order.createdAt)}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700">
                            Payment: {order.paymentStatus}
                          </span>
                          <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700">
                            Shipment: {order.shipmentStatus}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm text-zinc-600 sm:grid-cols-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Subtotal</div>
                          <div className="mt-1 font-medium text-zinc-900">{formatMoney(order.subtotalUsd)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Shipping</div>
                          <div className="mt-1 font-medium text-zinc-900">{formatMoney(order.shippingUsd)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Total</div>
                          <div className="mt-1 font-semibold text-zinc-900">{formatMoney(order.totalUsd)}</div>
                        </div>
                      </div>

                      {order.items.length > 0 ? (
                        <div className="mt-5 border-t border-zinc-200 pt-4">
                          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Items</div>
                          <div className="mt-3 space-y-3">
                            {order.items.map((item) => (
                              <div
                                key={`${order.id}-${item.variantId}`}
                                className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-3"
                              >
                                {item.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="h-16 w-16 rounded-2xl object-cover"
                                  />
                                ) : (
                                  <div className="h-16 w-16 rounded-2xl bg-zinc-100" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-semibold text-zinc-900">{item.name}</div>
                                  <div className="mt-1 text-sm text-zinc-600">
                                    Qty {item.quantity}
                                    {item.color ? ` · ${item.color}` : ""}
                                    {item.size ? ` · ${item.size}` : ""}
                                  </div>
                                  <div className="mt-1 text-sm text-zinc-500">
                                    Unit {formatMoney(item.unitPriceUsd)}
                                  </div>
                                </div>
                                {item.variantExists ? (
                                  <button
                                    type="button"
                                    onClick={() => buyOrderItemAgain(item)}
                                    className="shrink-0 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                                  >
                                    Buy again
                                  </button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {activeSection === "measurements" ? (
            <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">Measurements</h2>
                  <p className="mt-2 text-sm text-zinc-600">
                    Save the measurements you use most often so size comparisons stay consistent.
                  </p>
                </div>
                {profile.measurement ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMeasurementForm(measurementToForm(profile.measurement));
                      setIsEditingMeasurement(true);
                    }}
                    className="rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:border-zinc-500 hover:text-zinc-900"
                  >
                    Edit
                  </button>
                ) : null}
              </div>

              {profile.measurement && !isEditingMeasurement ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Height</p>
                    <p className="mt-3 text-2xl font-semibold">{profile.measurement.heightCm} cm</p>
                  </div>
                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Chest</p>
                    <p className="mt-3 text-2xl font-semibold">{profile.measurement.chestCm} cm</p>
                  </div>
                  <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Sleeve Length</p>
                    <p className="mt-3 text-2xl font-semibold">{profile.measurement.sleeveLengthCm} cm</p>
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-5">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <label className="text-sm text-zinc-700">
                      Height (cm)
                      <input
                        value={measurementForm.heightCm}
                        onChange={(event) => setMeasurementForm((current) => ({
                          ...current,
                          heightCm: event.target.value,
                        }))}
                        className={`mt-2 w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 ${
                          measurementErrors.heightCm ? "border-red-300" : "border-zinc-200"
                        }`}
                      />
                      {measurementErrors.heightCm ? (
                        <div className="mt-2 text-xs text-red-600">{measurementErrors.heightCm}</div>
                      ) : null}
                    </label>
                    <label className="text-sm text-zinc-700">
                      Chest (cm)
                      <input
                        value={measurementForm.chestCm}
                        onChange={(event) => setMeasurementForm((current) => ({
                          ...current,
                          chestCm: event.target.value,
                        }))}
                        className={`mt-2 w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 ${
                          measurementErrors.chestCm ? "border-red-300" : "border-zinc-200"
                        }`}
                      />
                      {measurementErrors.chestCm ? (
                        <div className="mt-2 text-xs text-red-600">{measurementErrors.chestCm}</div>
                      ) : null}
                    </label>
                    <label className="text-sm text-zinc-700">
                      Sleeve length (cm)
                      <input
                        value={measurementForm.sleeveLengthCm}
                        onChange={(event) => setMeasurementForm((current) => ({
                          ...current,
                          sleeveLengthCm: event.target.value,
                        }))}
                        className={`mt-2 w-full rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-900 ${
                          measurementErrors.sleeveLengthCm ? "border-red-300" : "border-zinc-200"
                        }`}
                      />
                      {measurementErrors.sleeveLengthCm ? (
                        <div className="mt-2 text-xs text-red-600">{measurementErrors.sleeveLengthCm}</div>
                      ) : null}
                    </label>
                  </div>

                  {measurementFormError ? (
                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {measurementFormError}
                    </div>
                  ) : null}

                  <div className="mt-5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={saveMeasurementForm}
                      disabled={savingMeasurement}
                      className="rounded-full bg-zinc-900 px-5 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-60"
                    >
                      {savingMeasurement ? "Saving..." : profile.measurement ? "Save changes" : "Save measurements"}
                    </button>
                    {profile.measurement ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMeasurementForm(emptyMeasurementForm());
                          setIsEditingMeasurement(false);
                        }}
                        className="rounded-full border border-zinc-300 px-5 py-2 text-sm text-zinc-700 hover:border-zinc-500 hover:text-zinc-900"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {activeSection === "shipping" ? (
            <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
              <h2 className="text-2xl font-semibold tracking-tight">Shipping Addresses</h2>
              <p className="mt-2 text-sm text-zinc-600">
                Keep up to two shipping addresses on file for faster checkout later.
              </p>

              <div className="mt-6 grid gap-4">
                {profile.shippingAddresses.map((address) => (
                  editingShippingAddressId === address.id ? (
                    <AddressFormFields
                      key={address.id}
                      values={shippingForms[0]}
                      onChange={(field, value) => {
                        setShippingForms((current) => current.map((form, formIndex) => (
                          formIndex === 0 ? { ...form, [field]: value } : form
                        )));
                        setShippingFormErrors((current) => current.map((item, itemIndex) => (
                          itemIndex === 0 ? { ...item, [field]: undefined } : item
                        )));
                        setShippingFormError(null);
                      }}
                      errors={shippingFormErrors[0]}
                      formError={shippingFormError}
                      submitLabel="Save changes"
                      onSubmit={() => saveAddressForm("shipping", shippingForms[0], 0, address.id)}
                      saving={savingShippingIndex === 0}
                      onCancel={() => {
                        setShippingForms((current) => current.map((form, formIndex) => (
                          formIndex === 0 ? emptyAddressForm() : form
                        )));
                        setEditingShippingAddressId(null);
                      }}
                    />
                  ) : (
                    <AddressCard
                      key={address.id}
                      address={address}
                      onEdit={() => {
                        setShippingForms((current) => current.map((form, formIndex) => (
                          formIndex === 0 ? addressToForm(address) : form
                        )));
                        setEditingShippingAddressId(address.id);
                        setShowSecondShippingForm(false);
                      }}
                      onDelete={() => deleteSavedAddress(address.id)}
                      deleting={deletingAddressId === address.id}
                    />
                  )
                ))}

                {profile.shippingAddresses.length === 1 && !showSecondShippingForm ? (
                  <button
                    type="button"
                    onClick={() => setShowSecondShippingForm(true)}
                    className="w-fit rounded-full border border-zinc-300 px-5 py-2 text-sm text-zinc-900 hover:border-zinc-500"
                  >
                    Add second shipping address
                  </button>
                ) : null}

                {nextShippingFormIndex !== null ? (
                  <AddressFormFields
                    key={`shipping-form-${nextShippingFormIndex}`}
                    values={shippingForms[nextShippingFormIndex]}
                    onChange={(field, value) => {
                      setShippingForms((current) => current.map((form, formIndex) => (
                        formIndex === nextShippingFormIndex ? { ...form, [field]: value } : form
                      )));
                      setShippingFormErrors((current) => current.map((item, itemIndex) => (
                        itemIndex === nextShippingFormIndex ? { ...item, [field]: undefined } : item
                      )));
                      setShippingFormError(null);
                    }}
                    errors={shippingFormErrors[nextShippingFormIndex]}
                    formError={shippingFormError}
                    submitLabel={
                      nextShippingFormIndex === 0 ? "Save shipping address" : "Save second shipping address"
                    }
                    onSubmit={() => saveAddressForm("shipping", shippingForms[nextShippingFormIndex], nextShippingFormIndex)}
                    saving={savingShippingIndex === nextShippingFormIndex}
                    onCancel={nextShippingFormIndex === 1 ? () => setShowSecondShippingForm(false) : undefined}
                  />
                ) : null}
              </div>
            </section>
          ) : null}

          {activeSection === "billing" ? (
            <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
              <h2 className="text-2xl font-semibold tracking-tight">Billing Addresses</h2>
              <p className="mt-2 text-sm text-zinc-600">
                Save a billing address if you want your order records to keep a separate payment address.
              </p>

              <div className="mt-6 grid gap-4">
                {profile.billingAddresses.map((address) => (
                  editingBillingAddressId === address.id ? (
                    <AddressFormFields
                      key={address.id}
                    values={billingForm}
                    onChange={(field, value) => {
                      setBillingForm((current) => ({ ...current, [field]: value }));
                      setBillingFormErrors((current) => ({ ...current, [field]: undefined }));
                      setBillingFormError(null);
                    }}
                    errors={billingFormErrors}
                    formError={billingFormError}
                    submitLabel="Save changes"
                      onSubmit={() => saveAddressForm("billing", billingForm, undefined, address.id)}
                      saving={savingBilling}
                      onCancel={() => {
                        setBillingForm(emptyAddressForm());
                        setEditingBillingAddressId(null);
                      }}
                    />
                  ) : (
                    <AddressCard
                      key={address.id}
                      address={address}
                      onEdit={() => {
                        setBillingForm(addressToForm(address));
                        setEditingBillingAddressId(address.id);
                      }}
                      onDelete={() => deleteSavedAddress(address.id)}
                      deleting={deletingAddressId === address.id}
                    />
                  )
                ))}

                {profile.billingAddresses.length === 0 ? (
                  showBillingForm ? (
                    <AddressFormFields
                      values={billingForm}
                      onChange={(field, value) => {
                        setBillingForm((current) => ({ ...current, [field]: value }));
                        setBillingFormErrors((current) => ({ ...current, [field]: undefined }));
                        setBillingFormError(null);
                      }}
                      errors={billingFormErrors}
                      formError={billingFormError}
                      submitLabel="Save billing address"
                      onSubmit={() => saveAddressForm("billing", billingForm)}
                      saving={savingBilling}
                      onCancel={() => {
                        setBillingForm(emptyAddressForm());
                        setBillingFormErrors({});
                        setBillingFormError(null);
                        setShowBillingForm(false);
                      }}
                    />
                  ) : (
                    <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-6">
                      <h3 className="text-lg font-semibold text-zinc-900">Is your billing address the same as shipping?</h3>
                      <p className="mt-2 text-sm text-zinc-600">
                        You can reuse your default shipping address or add a separate billing address.
                      </p>
                      {billingFormError ? (
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {billingFormError}
                        </div>
                      ) : null}
                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={useShippingAsBilling}
                          disabled={savingBilling}
                          className="rounded-full bg-zinc-900 px-5 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-60"
                        >
                          {savingBilling ? "Saving..." : "Yes, use shipping address"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBillingFormError(null);
                            setShowBillingForm(true);
                          }}
                          className="rounded-full border border-zinc-300 px-5 py-2 text-sm text-zinc-700 hover:border-zinc-500 hover:text-zinc-900"
                        >
                          No, add a separate billing address
                        </button>
                      </div>
                    </div>
                  )
                ) : null}
              </div>
            </section>
          ) : null}
      </div>
    </main>
  );
}
