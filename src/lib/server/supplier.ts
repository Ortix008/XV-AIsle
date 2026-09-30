export type ShipmentRequest = {
  orderId: string;
  number: string;
  sku: string;
  title: string;
  qty: number;
  supplierName: string;
  shipTo: {
    name: string;
    email: string;
    line1: string;
    city: string;
    region: string;
    postal: string;
    country: string;
  };
};

export type ShipmentResult = {
  status: "queued" | "accepted" | "supplier_error";
  ref: string | null;
  detail: string;
};

export async function requestShipment(
  input: ShipmentRequest,
  options?: { fetchImpl?: typeof fetch },
): Promise<ShipmentResult> {
  const url = process.env.SUPPLIER_API_URL;
  const apiKey = process.env.SUPPLIER_API_KEY;
  if (!url || !apiKey) {
    return {
      status: "queued",
      ref: null,
      detail: "Paid. The supplier connection is not set, so this order is waiting to be sent.",
    };
  }
  const send = options?.fetchImpl ?? fetch;
  try {
    const response = await send(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    const text = await response.text();
    if (!response.ok) {
      return {
        status: "supplier_error",
        ref: null,
        detail: `The supplier did not accept the order (${response.status}).`,
      };
    }
    let ref: string | null = null;
    try {
      const parsed = JSON.parse(text) as { reference?: unknown };
      if (typeof parsed.reference === "string" && parsed.reference.length > 0 && parsed.reference.length < 80) {
        ref = parsed.reference;
      }
    } catch {
      ref = null;
    }
    return {
      status: "accepted",
      ref,
      detail: ref ? `Supplier accepted the shipment as ${ref}.` : "Supplier accepted the shipment.",
    };
  } catch {
    return {
      status: "supplier_error",
      ref: null,
      detail: "The supplier connection did not answer.",
    };
  }
}
