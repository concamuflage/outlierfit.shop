"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateShippingCostRmb,
  getShippingModeSortOrder,
  type ShippingMode,
  type ShippingOption,
} from "@/lib/shipping";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const RMB_TO_USD = Number(process.env.NEXT_PUBLIC_RMB_TO_USD ?? "0.14");

export function useShippingOptions(totalWeightKg: number) {
  const [shippingModes, setShippingModes] = useState<ShippingMode[]>([]);
  const [selectedShippingModeId, setSelectedShippingModeId] = useState<number | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);

  useEffect(() => {
    if (!API_BASE_URL) {
      setShippingError("Missing API base URL.");
      return;
    }

    const fetchShippingModes = async () => {
      setShippingLoading(true);
      setShippingError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/shipping/costs`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const nextModes = Array.isArray(data) ? data : [];
        setShippingModes(nextModes);
        setSelectedShippingModeId((prev) => prev ?? nextModes[0]?.id ?? null);
      } catch (error: unknown) {
        setShippingModes([]);
        setShippingError(error instanceof Error ? error.message : "Failed to load shipping.");
      } finally {
        setShippingLoading(false);
      }
    };

    void fetchShippingModes();
  }, []);

  const shippingOptions = useMemo<ShippingOption[]>(() => {
    return shippingModes
      .map((mode) => ({
        ...mode,
        shippingCostUsd: calculateShippingCostRmb(totalWeightKg, mode) * RMB_TO_USD,
      }))
      .sort((a, b) => getShippingModeSortOrder(a.mode) - getShippingModeSortOrder(b.mode));
  }, [shippingModes, totalWeightKg]);

  const selectedShippingOption = useMemo(() => {
    return shippingOptions.find((option) => option.id === selectedShippingModeId) ?? null;
  }, [selectedShippingModeId, shippingOptions]);

  return {
    shippingError,
    shippingLoading,
    shippingOptions,
    selectedShippingModeId,
    selectedShippingOption,
    setSelectedShippingModeId,
  };
}
