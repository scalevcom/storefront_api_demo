import {
  CreditCard,
  Heart,
  KeyRound,
  Loader2,
  LogIn,
  Mail,
  Menu,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  User,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DEMO_PRODUCT_SLUGS, DEMO_VARIANT_IDS, INDONESIA_PROVINCES } from "./config";
import { probeScalev, scalevRequest } from "./api";
import type {
  ApiResult,
  Cart,
  CartItem,
  Category,
  CityOption,
  CollectionResponse,
  FlowLog,
  LocationOption,
  PaymentMethod,
  PostalCodeOption,
  ProvinceOption,
  Product,
  ProductVariant
} from "./types";
import { cartItemCount, cartTotal, money, nowStamp, productImage, truncate, variantLabel } from "./utils";

const emptyCheckout = {
  name: "Demo Customer",
  email: "demo.customer@example.com",
  phone: "+6281234567890",
  address: "Jl. Demo Storefront API No. 3",
  city: "Jakarta",
  postalCode: "10210",
  paymentMethod: "bank_transfer"
};

const CHECKOUT_FIELDS = ["name", "email", "phone", "address"] as const;

const FALLBACK_PAYMENT_METHODS: PaymentMethod[] = [
  {
    code: "bank_transfer",
    label: "Bank transfer",
    enabled: true,
    requires_redirect: false,
    description: "Place the order now and receive payment instructions."
  }
];

type LocationMode = "guided" | "search";
type AccountMode = "login" | "reset";

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [selectedSlug, setSelectedSlug] = useState(DEMO_PRODUCT_SLUGS[0]);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<Cart | null>(null);
  const [flowLogs, setFlowLogs] = useState<FlowLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [checkoutForm, setCheckoutForm] = useState(emptyCheckout);
  const [orderSecret, setOrderSecret] = useState("");
  const [orderPaymentUrl, setOrderPaymentUrl] = useState("");
  const [locationMode, setLocationMode] = useState<LocationMode>("guided");
  const [province, setProvince] = useState("DKI Jakarta");
  const [guidedCity, setGuidedCity] = useState("");
  const [provinceLocations, setProvinceLocations] = useState<LocationOption[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const [postalCodes, setPostalCodes] = useState<PostalCodeOption[]>([]);
  const [provinceRecords, setProvinceRecords] = useState<ProvinceOption[]>([]);
  const [provinceOptions, setProvinceOptions] = useState(INDONESIA_PROVINCES);
  const [deliveryCities, setDeliveryCities] = useState<CityOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(FALLBACK_PAYMENT_METHODS);
  const [locationSearch, setLocationSearch] = useState("Cempaka Putih");
  const [locationResults, setLocationResults] = useState<LocationOption[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationNotice, setLocationNotice] = useState("");
  const [availability, setAvailability] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [cartOpen, setCartOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [shopNotice, setShopNotice] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPassword, setCustomerPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [accountMode, setAccountMode] = useState<AccountMode>(() =>
    initialResetToken() ? "reset" : "login"
  );
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [customerToken, setCustomerToken] = useState(() => localStorage.getItem("scalev_customer_token") || "");
  const [customerRefreshToken, setCustomerRefreshToken] = useState(
    () => localStorage.getItem("scalev_customer_refresh_token") || ""
  );
  const [customerOutput, setCustomerOutput] = useState("");

  const selectedProduct = useMemo(
    () => products.find((item) => item.slug === selectedSlug) || products[0] || null,
    [products, selectedSlug]
  );

  const selectedVariant = useMemo(() => {
    if (!selectedProduct?.variants?.length) return null;
    return (
      selectedProduct.variants.find((variant) => variant.id === selectedVariantId) ||
      selectedProduct.variants[0]
    );
  }, [selectedProduct, selectedVariantId]);

  const featuredProduct = products.find((product) => product.slug === "activelife-smart-bottle") || products[0];

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.item_type?.toLowerCase().includes(query) ||
        product.taxonomy?.full_path?.toLowerCase().includes(query);
      const matchesCategory =
        activeCategory === "All" ||
        product.item_type?.toLowerCase() === activeCategory.toLowerCase() ||
        product.taxonomy?.full_path?.includes(activeCategory);
      return matchesQuery && matchesCategory;
    });
  }, [activeCategory, products, searchTerm]);

  const categoryFilters = useMemo(() => {
    const itemTypes = new Set(products.map((product) => product.item_type).filter(Boolean) as string[]);
    const apiCategories = categories.map((category) => category.name).slice(0, 3);
    return ["All", ...Array.from(itemTypes), ...apiCategories].slice(0, 6);
  }, [categories, products]);

  const cityOptions = useMemo(
    () => uniqueSorted(deliveryCities.map((city) => city.city_name)),
    [deliveryCities]
  );

  const subdistrictOptions = useMemo(
    () =>
      provinceLocations
        .sort((a, b) => a.subdistrict_name.localeCompare(b.subdistrict_name)),
    [provinceLocations]
  );

  useEffect(() => {
    void loadStorefront();
  }, []);

  useEffect(() => {
    if (resetToken) {
      setAccountMode("reset");
      setAccountOpen(true);
      setCustomerOutput("Set a new password to continue.");
    }
  }, [resetToken]);

  useEffect(() => {
    void loadProvinceCities(province);
  }, [province, provinceRecords]);

  useEffect(() => {
    if (cityOptions.length && !cityOptions.includes(guidedCity)) {
      setGuidedCity(cityOptions[0]);
    }
  }, [cityOptions, guidedCity]);

  useEffect(() => {
    if (guidedCity) {
      void loadCitySubdistricts(guidedCity);
    }
  }, [deliveryCities, guidedCity]);

  useEffect(() => {
    if (locationMode !== "guided" || !subdistrictOptions.length) return;
    if (!selectedLocation || selectedLocation.city_name !== guidedCity || selectedLocation.province_name !== province) {
      void selectDeliveryLocation(subdistrictOptions[0]);
    }
  }, [guidedCity, locationMode, province, selectedLocation, subdistrictOptions]);

  useEffect(() => {
    if (locationSearch.trim().length < 2) {
      setLocationResults([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      void searchDeliveryLocations(locationSearch);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [locationSearch]);

  useEffect(() => {
    if (!selectedProduct?.variants?.length) {
      setSelectedVariantId(null);
      return;
    }
    if (!selectedProduct.variants.some((variant) => variant.id === selectedVariantId)) {
      setSelectedVariantId(selectedProduct.variants[0].id);
    }
  }, [selectedProduct, selectedVariantId]);

  useEffect(() => {
    if (selectedVariantId) {
      void loadVariantAvailability(selectedVariantId);
    }
  }, [selectedVariantId]);

  function addLog(label: string, status: FlowLog["status"], detail: string) {
    setFlowLogs((logs) => [{ at: nowStamp(), label, status, detail }, ...logs].slice(0, 12));
  }

  async function loadStorefront() {
    setLoading(true);
    setShopNotice("");

    const probe = await probeScalev();
    addLog("Connectivity", probe.directUsable ? "ok" : "error", probe.message);

    const [countResult, categoriesResult, productPages, pricingResult, paymentMethodsResult, provincesResult] =
      await Promise.all([
        scalevRequest<{ total: number }>("public/products/count"),
        scalevRequest<CollectionResponse<Category>>("public/categories"),
        loadProductPages(12),
        scalevRequest<CollectionResponse<Record<string, unknown>>>(
          `public/variants/pricing?ids=${DEMO_VARIANT_IDS.join(",")}`
        ),
        scalevRequest<CollectionResponse<PaymentMethod>>("public/payment-methods"),
        scalevRequest<CollectionResponse<ProvinceOption>>("public/locations/provinces")
      ]);

    if (countResult.ok && countResult.data) {
      setProductCount(Number(countResult.data.total));
      addLog("Product count", "ok", `Scalev returned ${countResult.data.total} public products.`);
    }

    if (categoriesResult.ok && categoriesResult.data?.data) {
      setCategories(categoriesResult.data.data);
    }

    if (pricingResult.ok && pricingResult.data?.data) {
      addLog("Variant pricing", "ok", `Returned ${pricingResult.data.data.length} rows.`);
    }

    if (paymentMethodsResult.ok && paymentMethodsResult.data?.data?.length) {
      const enabledMethods = paymentMethodsResult.data.data.filter((method) => method.enabled !== false);
      if (enabledMethods.length) {
        setPaymentMethods(enabledMethods);
        setCheckoutForm((current) =>
          enabledMethods.some((method) => method.code === current.paymentMethod)
            ? current
            : { ...current, paymentMethod: enabledMethods[0].code }
        );
        addLog(
          "Payment methods",
          "ok",
          `Loaded ${enabledMethods.map((method) => method.label || method.code).join(", ")}.`
        );
      }
    }

    if (provincesResult.ok && provincesResult.data?.data?.length) {
      setProvinceRecords(provincesResult.data.data);
      setProvinceOptions(
        uniqueSorted(provincesResult.data.data.map((item) => item.province_name).filter(Boolean))
      );
      addLog("Delivery provinces", "ok", `Loaded ${provincesResult.data.data.length} provinces.`);
    }

    if (productPages.products.length) {
      setProducts(productPages.products);
      addLog(
        "Product list",
        productPages.error ? "warn" : "ok",
        `Loaded ${productPages.products.length} products from ${productPages.pageCount} cursor page${
          productPages.pageCount === 1 ? "" : "s"
        }.`
      );
    } else {
      const detail = `${productPages.error?.status || 0}: ${
        productPages.error?.error || "GET /public/products failed"
      }${
        productPages.error?.requestId ? ` (request ${productPages.error.requestId})` : ""
      }`;
      addLog("Product list", "error", detail);
      setShopNotice("A few shelves are being refreshed. Showing this week's featured picks.");
      const fallbackProducts = await loadFallbackProducts();
      setProducts(fallbackProducts);
      if (fallbackProducts.length) {
        addLog("Catalog fallback", "warn", `Loaded ${fallbackProducts.length} products by slug.`);
      }
    }

    await refreshCart("Initial cart");
    setLoading(false);
  }

  async function loadFallbackProducts(): Promise<Product[]> {
    const results = await Promise.all(
      DEMO_PRODUCT_SLUGS.map((slug) => scalevRequest<Product>(`public/products/${slug}`))
    );
    return results
      .filter((result): result is ApiResult<Product> & { data: Product } => result.ok && !!result.data)
      .map((result) => result.data);
  }

  async function loadProductPages(limit: number) {
    const products = new Map<number, Product>();
    const pageSize = 5;
    let endpoint = `public/products?page_size=${pageSize}`;
    let pageCount = 0;
    let error: ApiResult<CollectionResponse<Product>> | undefined;

    while (endpoint && products.size < limit && pageCount < 8) {
      const result = await scalevRequest<CollectionResponse<Product>>(endpoint);
      if (!result.ok || !result.data?.data) {
        error = result;
        break;
      }

      pageCount += 1;
      for (const product of result.data.data) {
        products.set(product.id, product);
      }

      endpoint =
        result.data.has_next && result.data.next_cursor
          ? `public/products?next_cursor=${encodeURIComponent(result.data.next_cursor)}&page_size=${pageSize}`
          : "";
    }

    return {
      products: Array.from(products.values()).slice(0, limit),
      pageCount,
      error
    };
  }

  async function loadProvinceCities(nextProvince: string) {
    setLocationLoading(true);
    setLocationNotice("");
    const provinceRecord = provinceRecords.find((item) => item.province_name === nextProvince);
    const provinceId = provinceOptionId(provinceRecord);

    if (!provinceId) {
      setLocationLoading(false);
      return;
    }

    const result = await scalevRequest<CollectionResponse<CityOption>>(
      `public/locations/cities?province_id=${provinceId}`
    );

    if (result.ok && result.data?.data?.length) {
      const cities = result.data.data;
      setDeliveryCities(cities);
      setProvinceLocations([]);
      addLog("Delivery cities", "ok", `Loaded ${cities.length} cities from Storefront API.`);
    } else {
      setDeliveryCities([]);
      setProvinceLocations([]);
      setLocationNotice("Delivery area lookup is unavailable.");
      addLog(
        "Delivery cities",
        "error",
        `${result.status}: ${result.error || "Unable to load cities"}${
          result.requestId ? ` (request ${result.requestId})` : ""
        }`
      );
    }

    setLocationLoading(false);
  }

  async function loadCitySubdistricts(cityName: string) {
    const city = deliveryCities.find((item) => item.city_name === cityName);
    const cityId = cityOptionId(city);
    if (!cityId) return;

    setLocationLoading(true);
    const result = await scalevRequest<CollectionResponse<LocationOption>>(
      `public/locations/subdistricts?city_id=${cityId}`
    );

    if (result.ok && result.data?.data?.length) {
      setProvinceLocations(result.data.data);
      setLocationNotice("");
      addLog("Delivery districts", "ok", `Loaded ${result.data.data.length} districts from Storefront API.`);
    } else {
      setProvinceLocations([]);
      setLocationNotice("No delivery districts found for this city.");
      addLog(
        "Delivery districts",
        "error",
        `${result.status}: ${result.error || "Unable to load districts"}${
          result.requestId ? ` (request ${result.requestId})` : ""
        }`
      );
    }

    setLocationLoading(false);
  }

  async function searchDeliveryLocations(query: string) {
    setLocationLoading(true);
    const locations = await fetchLocations(query, 2);
    setLocationResults(locations.slice(0, 12));
    if (!locations.length) {
      setLocationNotice("No matching delivery area found.");
    } else {
      setLocationNotice("");
    }
    setLocationLoading(false);
  }

  async function fetchLocations(query: string, maxPages: number): Promise<LocationOption[]> {
    const locations = new Map<number, LocationOption>();
    let endpoint = `public/locations?search=${encodeURIComponent(query)}&page_size=100`;

    for (let page = 0; page < maxPages && endpoint; page += 1) {
      const result = await scalevRequest<CollectionResponse<LocationOption>>(endpoint);
      if (!result.ok || !result.data?.data) {
        addLog(
          "Location lookup",
          "error",
          `${result.status}: ${result.error || "Unable to load delivery areas"}${
            result.requestId ? ` (request ${result.requestId})` : ""
          }`
        );
        return Array.from(locations.values());
      }

      for (const location of result.data.data) {
        locations.set(location.id, location);
      }

      endpoint =
        result.data.has_next && result.data.next_cursor
          ? `public/locations?next_cursor=${encodeURIComponent(result.data.next_cursor)}&page_size=100`
          : "";
    }

    return Array.from(locations.values());
  }

  async function selectDeliveryLocation(location: LocationOption) {
    setSelectedLocation(location);
    setCheckoutForm((current) => ({
      ...current,
      city: location.city_name
    }));
    await loadPostalCodes(location);
  }

  async function loadPostalCodes(location: LocationOption) {
    const result = await scalevRequest<CollectionResponse<PostalCodeOption>>(
      `public/locations/${location.id}/postal-codes`
    );

    if (result.ok && result.data?.data?.length) {
      const codes = result.data.data;
      setPostalCodes(codes);
      setCheckoutForm((current) => ({
        ...current,
        postalCode:
          codes.find((item) => item.postal_code === current.postalCode)?.postal_code ||
          codes[0].postal_code
      }));
      setLocationNotice("");
    } else {
      setPostalCodes([]);
      setLocationNotice("Postal code lookup is unavailable for this area.");
      addLog(
        "Postal codes",
        "error",
        `${result.status}: ${result.error || "Unable to load postal codes"}${
          result.requestId ? ` (request ${result.requestId})` : ""
        }`
      );
    }
  }

  async function loadVariantAvailability(variantId: number) {
    const result = await scalevRequest<Record<string, unknown>>(`public/variants/${variantId}/availability`);
    if (result.ok && result.data) {
      const available = result.data.available === true ? "Ready to order" : "Availability pending";
      const stock = typeof result.data.stock_status === "string" ? result.data.stock_status.replace(/_/g, " ") : "";
      setAvailability(stock ? `${available} • ${stock}` : available);
    } else {
      setAvailability("Availability is being checked");
    }
  }

  async function refreshCart(label = "Cart") {
    const result = await scalevRequest<Cart>("public/cart");
    if (result.ok && result.data) {
      setCart(result.data);
      addLog(label, "ok", `${cartItemCount(result.data)} items, ${cartTotal(result.data)}.`);
    } else {
      addLog(label, "error", `${result.status}: ${result.error || "Cart request failed"}`);
    }
  }

  async function addToCart(variant: ProductVariant | null, amount = quantity) {
    if (!variant) return;
    setBusyAction(`add-${variant.id}`);
    const result = await scalevRequest<Cart>("public/cart/items", {
      method: "POST",
      body: {
        variant_id: variant.id,
        quantity: amount
      }
    });
    if (result.ok) {
      addLog("Add to cart", "ok", `${variantLabel(variant)} x${amount}`);
      await refreshCart("Cart refresh");
      setCartOpen(true);
    } else {
      addLog("Add to cart", "error", `${result.status}: ${result.error || "Unable to add item"}`);
      setShopNotice("We could not add that item. Please try again.");
    }
    setBusyAction(null);
  }

  async function addProductToCart(product: Product) {
    const variant = product.variants?.[0] || null;
    await addToCart(variant, 1);
  }

  function openQuickView(product: Product) {
    setSelectedSlug(product.slug);
    setSelectedVariantId(product.variants?.[0]?.id || null);
    setQuantity(1);
    setQuickViewOpen(true);
  }

  async function updateCartItem(item: CartItem, nextQuantity: number) {
    if (nextQuantity < 1) return;
    setBusyAction(`update-${item.id}`);
    const result = await scalevRequest<Cart>(`public/cart/items/${item.id}`, {
      method: "PATCH",
      body: { quantity: nextQuantity }
    });
    addLog(
      "Update cart",
      result.ok ? "ok" : "error",
      result.ok ? `Item ${item.id} quantity ${nextQuantity}` : `${result.status}: ${result.error}`
    );
    await refreshCart("Cart refresh");
    setBusyAction(null);
  }

  async function removeCartItem(item: CartItem) {
    setBusyAction(`remove-${item.id}`);
    const result = await scalevRequest(`public/cart/items/${item.id}`, {
      method: "DELETE"
    });
    addLog(
      "Remove item",
      result.ok ? "ok" : "error",
      result.ok ? `Removed item ${item.id}` : `${result.status}: ${result.error}`
    );
    await refreshCart("Cart refresh");
    setBusyAction(null);
  }

  async function runGuestCheckout() {
    setBusyAction("checkout");
    const items =
      cart?.items?.map((item) => ({
        variant_id: item.variant_id,
        quantity: item.quantity
      })) ||
      (selectedVariant
        ? [
            {
              variant_id: selectedVariant.id,
              quantity
            }
          ]
        : []);

    const payload = {
      items,
      customer_name: checkoutForm.name,
      customer_email: checkoutForm.email,
      customer_phone: checkoutForm.phone.replace(/^\+/, ""),
      shipping_address: checkoutForm.address,
      shipping_city: selectedLocation?.city_name || checkoutForm.city,
      shipping_province: selectedLocation?.province_name,
      shipping_subdistrict: selectedLocation?.subdistrict_name,
      shipping_postal_code: checkoutForm.postalCode,
      location_id: selectedLocation?.id,
      shipping_location_id: selectedLocation?.id,
      payment_method: checkoutForm.paymentMethod
    };
    const result = await scalevRequest<Record<string, unknown>>("public/guest-checkout", {
      method: "POST",
      body: payload
    });

    if (result.ok && result.data) {
      const secret = findSecretSlug(result.data);
      const paymentUrl = findPaymentUrl(result.data);
      if (secret) setOrderSecret(secret);
      if (paymentUrl) setOrderPaymentUrl(paymentUrl);
      addLog("Guest checkout", "ok", secret ? `Created order ${secret}` : "Checkout returned success.");
      setShopNotice(paymentUrl ? "Order created. Payment instructions are ready." : "Order created.");
    } else {
      addLog(
        "Guest checkout",
        "error",
        `${result.status}: ${result.error || "Checkout failed"}${
          result.requestId ? ` (request ${result.requestId})` : ""
        }`
      );
      setShopNotice("Checkout is not available for this payment method yet.");
    }
    setBusyAction(null);
  }

  async function fetchOrder() {
    if (!orderSecret) return;
    setBusyAction("order");
    const result = await scalevRequest<Record<string, unknown>>(`public/orders/${orderSecret}`);
    addLog(
      "Order lookup",
      result.ok ? "ok" : "error",
      result.ok ? `Loaded ${orderSecret}` : `${result.status}: ${result.error || "Order not found"}`
    );
    setBusyAction(null);
  }

  async function createPayment() {
    if (!orderSecret) {
      addLog("Payment", "warn", "Payment requires a public order secret from checkout.");
      return;
    }
    setBusyAction("payment");
    const result = await scalevRequest<Record<string, unknown>>(`public/orders/${orderSecret}/payment`, {
      method: "POST"
    });
    addLog(
      "Payment",
      result.ok ? "ok" : "error",
      result.ok ? "Payment response received." : `${result.status}: ${result.error || "Payment failed"}`
    );
    if (result.ok && result.data) {
      const paymentUrl = findPaymentUrl(result.data);
      if (paymentUrl) setOrderPaymentUrl(paymentUrl);
    } else {
      setShopNotice("Payment instructions are not ready yet. Use order status to check this order.");
    }
    setBusyAction(null);
  }

  async function startCustomerLogin() {
    if (!customerEmail || !customerPassword) {
      setCustomerOutput("Enter your email and password first.");
      return;
    }
    setBusyAction("otp");
    const result = await scalevRequest<Record<string, unknown>>("public/auth/login", {
      method: "POST",
      body: {
        email: customerEmail,
        password: customerPassword,
        login_as: "customer"
      }
    });
    handleAuthResponse("Customer login", result);
    setBusyAction(null);
  }

  async function verifyOtp() {
    if (!customerEmail || !otpCode) {
      setCustomerOutput("Enter your email and one-time code first.");
      return;
    }
    setBusyAction("otp-verify");
    const result = await scalevRequest<Record<string, unknown>>("public/auth/otp/verify", {
      method: "POST",
      body: {
        email: customerEmail,
        otp: otpCode,
        login_as: "customer"
      }
    });
    handleAuthResponse("OTP verify", result);
    setBusyAction(null);
  }

  async function requestPasswordReset() {
    if (!customerEmail) {
      setCustomerOutput("Enter your email first.");
      return;
    }
    setBusyAction("forget-password");
    setResetPassword("");
    setResetPasswordConfirm("");
    const result = await scalevRequest<Record<string, unknown>>("public/auth/forget-password", {
      method: "POST",
      body: {
        email: customerEmail
      }
    });
    if (result.ok) {
      setCustomerOutput("If this email belongs to a customer account, a reset email is on the way.");
      addLog("Password reset", "ok", "Reset email request accepted.");
    } else {
      setCustomerOutput("We could not request a password reset right now.");
      addLog(
        "Password reset",
        "error",
        `${result.status}: ${result.error || "Reset request failed"}${
          result.requestId ? ` (request ${result.requestId})` : ""
        }`
      );
    }
    setBusyAction(null);
  }

  async function savePasswordReset() {
    if (!resetToken) {
      setCustomerOutput("Open the reset link from your email first.");
      return;
    }
    if (!resetPassword || !resetPasswordConfirm) {
      setCustomerOutput("Enter and confirm your new password.");
      return;
    }
    if (resetPassword !== resetPasswordConfirm) {
      setCustomerOutput("Passwords do not match.");
      return;
    }
    setBusyAction("save-password");
    const result = await scalevRequest<Record<string, unknown>>("public/auth/save-password", {
      method: "POST",
      body: {
        token: resetToken,
        password: resetPassword
      }
    });
    if (result.ok) {
      setCustomerPassword(resetPassword);
      setResetPassword("");
      setResetPasswordConfirm("");
      setResetToken("");
      setOtpRequested(false);
      setAccountMode("login");
      setCustomerOutput("Password saved. Sign in with your new password.");
      addLog("Save password", "ok", "Customer password reset completed.");
      clearResetTokenFromUrl();
    } else {
      setCustomerOutput("We could not save the new password. Check the reset token and try again.");
      addLog(
        "Save password",
        "error",
        `${result.status}: ${result.error || "Save password failed"}${
          result.requestId ? ` (request ${result.requestId})` : ""
        }`
      );
    }
    setBusyAction(null);
  }

  function handleAuthResponse(label: string, result: ApiResult<Record<string, unknown>>) {
    if (!result.ok) {
      setCustomerOutput("We could not complete sign in. Check your details and try again.");
      addLog(label, "error", `${result.status}: ${result.error || "Auth request failed"}`);
      return;
    }

    const token = result.data ? findToken(result.data) : null;
    if (token) {
      const refreshToken = result.data ? findRefreshToken(result.data) : null;
      setCustomerToken(token);
      if (refreshToken) {
        setCustomerRefreshToken(refreshToken);
        localStorage.setItem("scalev_customer_refresh_token", refreshToken);
      }
      setOtpRequested(false);
      setAccountMode("login");
      localStorage.setItem("scalev_customer_token", token);
      setCustomerOutput("You are signed in. Your account area is ready.");
      addLog(label, "ok", label === "Customer login" ? "Signed in without OTP challenge." : "Session saved.");
      return;
    }

    if (label === "Customer login") {
      setOtpRequested(true);
      setOtpCode("");
      setCustomerOutput("Check your inbox for the sign-in code.");
      addLog(label, "ok", "OTP is required for this store; email code sent.");
      return;
    }

    setCustomerOutput("Sign in succeeded, but no customer session token was returned.");
    addLog(label, "error", "Auth response did not include a customer token.");
  }

  async function callCustomerEndpoint(label: string, path: string) {
    if (!customerToken) {
      addLog(label, "warn", "Customer endpoint requires a session.");
      setShopNotice("Sign in before opening account details.");
      setCustomerOutput("Sign in to view account details and order history.");
      return;
    }
    setBusyAction(path);
    const result = await scalevRequest<Record<string, unknown>>(path, {
      token: customerToken
    });
    setCustomerOutput(
      result.ok
        ? `${label} is connected for this customer account.`
        : `We could not load ${label.toLowerCase()} right now.`
    );
    addLog(label, result.ok ? "ok" : "error", result.ok ? "Response received." : `${result.status}: ${result.error}`);
    setBusyAction(null);
  }

  async function refreshCustomerJwt() {
    if (!customerRefreshToken) {
      addLog("JWT refresh", "warn", "Refresh requires the current customer session.");
      setCustomerOutput("Sign in again to refresh this customer session.");
      return;
    }
    setBusyAction("jwt-refresh");
    const result = await scalevRequest<Record<string, unknown>>("public/auth/jwt/refresh", {
      method: "POST",
      body: { refresh: customerRefreshToken }
    });
    handleAuthResponse("Session refresh", result);
    setBusyAction(null);
  }

  async function logoutCustomerJwt() {
    if (!customerToken) {
      clearCustomerSession();
      return;
    }
    setBusyAction("jwt-blacklist");
    const result = await scalevRequest<Record<string, unknown>>("public/auth/jwt/blacklist", {
      method: "POST",
      body: { tokens: [customerToken, customerRefreshToken].filter(Boolean) }
    });
    addLog(
      "Customer logout",
      result.ok ? "ok" : "warn",
      result.ok ? "Session closed." : `${result.status}: ${result.error || "Local session cleared"}`
    );
    clearCustomerSession();
    setBusyAction(null);
  }

  function clearCustomerSession() {
    setCustomerToken("");
    setCustomerRefreshToken("");
    setOtpRequested(false);
    setCustomerOutput("You have been signed out.");
    localStorage.removeItem("scalev_customer_token");
    localStorage.removeItem("scalev_customer_refresh_token");
    addLog("Customer session", "warn", "Local session cleared.");
  }

  return (
    <div className="shop-shell">
      <header className="shop-header">
        <a className="brand-mark" href="#top" aria-label="Mutaqin Friend Store home">
          <span>M</span>
          <strong>Mutaqin Friend</strong>
        </a>
        <nav className="main-nav" aria-label="Store navigation">
          <a href="#collection">Shop</a>
          <a href="#featured">Featured</a>
          <a href="#journal">About</a>
        </nav>
        <div className="header-actions">
          <button className="ghost-button mobile-menu" aria-label="Menu">
            <Menu size={20} />
          </button>
          <button className="ghost-button" onClick={() => setAccountOpen(true)} aria-label="Account">
            <User size={20} />
          </button>
          <button className="cart-button" onClick={() => setCartOpen(true)} data-testid="cart-total">
            <ShoppingCart size={20} />
            <span>{cartItemCount(cart)}</span>
            <strong>{cartTotal(cart)}</strong>
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero-storefront">
          <div className="hero-copy">
            <p className="store-kicker">Curated learning, digital goods, and everyday essentials</p>
            <h1>Mutaqin Friend Store&apos;s</h1>
            <p>
              Shop practical picks from courses and ebooks to smart physical products, all fulfilled
              through a simple online checkout experience.
            </p>
            <div className="hero-actions">
              <a className="primary-link" href="#collection">
                <ShoppingBag size={19} />
                Shop collection
              </a>
              <button className="text-link" onClick={() => featuredProduct && openQuickView(featuredProduct)}>
                View featured
              </button>
            </div>
          </div>
          <div className="hero-product" id="featured">
            {featuredProduct ? (
              <>
                {productImage(featuredProduct) ? (
                  <img src={productImage(featuredProduct)!} alt={featuredProduct.name} />
                ) : (
                  <div className="hero-image-fallback">{featuredProduct.name.slice(0, 2)}</div>
                )}
                <div>
                  <span>{featuredProduct.item_type || "Featured"}</span>
                  <h2>{featuredProduct.name}</h2>
                  <p>{money(featuredProduct.price_range?.min, featuredProduct.variants?.[0]?.currency || "IDR")}</p>
                </div>
              </>
            ) : (
              <div className="hero-loading">
                <Loader2 size={24} className="spin" />
                Loading collection
              </div>
            )}
          </div>
        </section>

        <section className="shop-toolbar" aria-label="Shop filters">
          <div className="search-box">
            <Search size={19} />
            <input
              placeholder="Search products"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="filter-row">
            {categoryFilters.map((category) => (
              <button
                key={category}
                className={category === activeCategory ? "filter-chip active" : "filter-chip"}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </section>

        {shopNotice ? <div className="shop-notice">{shopNotice}</div> : null}

        <section className="collection-section" id="collection">
          <div className="collection-heading">
            <div>
              <p className="store-kicker">Collection</p>
              <h2>Fresh picks</h2>
            </div>
            <p>
              {loading ? "Preparing products..." : `${filteredProducts.length} shown${productCount ? ` from ${productCount}` : ""}`}
            </p>
          </div>

          <div className="product-grid" data-testid="product-grid">
            {filteredProducts.map((product) => (
              <article className="product-card" key={product.id} data-testid={`product-card-${product.slug}`}>
                <button className="wishlist-button" aria-label={`Save ${product.name}`}>
                  <Heart size={18} />
                </button>
                <button className="product-image-button" onClick={() => openQuickView(product)}>
                  {productImage(product) ? (
                    <img src={productImage(product)!} alt={product.name} />
                  ) : (
                    <div className="image-fallback">{product.name.slice(0, 2)}</div>
                  )}
                </button>
                <div className="product-info">
                  <span>{product.item_type || "product"}</span>
                  <button onClick={() => openQuickView(product)}>{product.name}</button>
                  <div className="product-footer">
                    <strong>{money(product.price_range?.min, product.variants?.[0]?.currency || "IDR")}</strong>
                    <button
                      className="small-add"
                      onClick={() => void addProductToCart(product)}
                      disabled={!product.variants?.length || busyAction === `add-${product.variants?.[0]?.id}`}
                    >
                      <Plus size={17} />
                      Add
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="story-band" id="journal">
          <div>
            <PackageCheck size={28} />
            <h2>Shop at your pace</h2>
            <p>
              Browse the current collection, save your favorites, and build a cart before checkout.
              Available payment options appear when the store is ready to accept them.
            </p>
          </div>
        </section>
      </main>

      <CartDrawer
        cart={cart}
        checkoutForm={checkoutForm}
        checkoutOpen={checkoutOpen}
        busyAction={busyAction}
        orderSecret={orderSecret}
        orderPaymentUrl={orderPaymentUrl}
        cityOptions={cityOptions}
        guidedCity={guidedCity}
        locationLoading={locationLoading}
        locationMode={locationMode}
        locationNotice={locationNotice}
        locationResults={locationResults}
        locationSearch={locationSearch}
        paymentMethods={paymentMethods}
        postalCodes={postalCodes}
        province={province}
        provinceOptions={provinceOptions}
        selectedLocation={selectedLocation}
        subdistrictOptions={subdistrictOptions}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckoutOpen={() => setCheckoutOpen((value) => !value)}
        onCheckoutFormChange={setCheckoutForm}
        onCreatePayment={createPayment}
        onFetchOrder={fetchOrder}
        onGuidedCityChange={setGuidedCity}
        onLocationModeChange={setLocationMode}
        onLocationSearchChange={setLocationSearch}
        onPostalCodeChange={(postalCode) => setCheckoutForm((current) => ({ ...current, postalCode }))}
        onProvinceChange={(nextProvince) => {
          setProvince(nextProvince);
          setGuidedCity("");
          setDeliveryCities([]);
          setProvinceLocations([]);
          setSelectedLocation(null);
          setPostalCodes([]);
          setCheckoutForm((current) => ({ ...current, postalCode: "" }));
        }}
        onSelectLocation={(location) => void selectDeliveryLocation(location)}
        onRemove={removeCartItem}
        onRunCheckout={runGuestCheckout}
        onUpdate={updateCartItem}
      />

      <QuickView
        availability={availability}
        busyAction={busyAction}
        onAdd={() => void addToCart(selectedVariant)}
        onClose={() => setQuickViewOpen(false)}
        onQuantityChange={setQuantity}
        onVariantChange={setSelectedVariantId}
        open={quickViewOpen}
        product={selectedProduct}
        quantity={quantity}
        selectedVariant={selectedVariant}
      />

      <AccountDrawer
        accountMode={accountMode}
        customerEmail={customerEmail}
        customerOutput={customerOutput}
        customerPassword={customerPassword}
        customerToken={customerToken}
        busyAction={busyAction}
        otpRequested={otpRequested}
        resetPassword={resetPassword}
        resetPasswordConfirm={resetPasswordConfirm}
        resetToken={resetToken}
        onCallCustomerEndpoint={callCustomerEndpoint}
        onClose={() => setAccountOpen(false)}
        onEmailChange={(email) => {
          setCustomerEmail(email);
          setOtpRequested(false);
          setOtpCode("");
        }}
        onLogout={logoutCustomerJwt}
        onModeChange={(mode) => {
          setAccountMode(mode);
          if (mode === "reset") setOtpRequested(false);
        }}
        onOtpChange={setOtpCode}
        onPasswordChange={(password) => {
          setCustomerPassword(password);
          setOtpRequested(false);
          setOtpCode("");
        }}
        onRefresh={refreshCustomerJwt}
        onRequestPasswordReset={requestPasswordReset}
        onResetPasswordConfirmChange={setResetPasswordConfirm}
        onResetPasswordChange={setResetPassword}
        onSavePasswordReset={savePasswordReset}
        onStartCustomerLogin={startCustomerLogin}
        onVerifyOtp={verifyOtp}
        open={accountOpen}
        otpCode={otpCode}
      />

    </div>
  );
}

interface CartDrawerProps {
  cart: Cart | null;
  checkoutForm: typeof emptyCheckout;
  checkoutOpen: boolean;
  busyAction: string | null;
  orderSecret: string;
  orderPaymentUrl: string;
  cityOptions: string[];
  guidedCity: string;
  locationLoading: boolean;
  locationMode: LocationMode;
  locationNotice: string;
  locationResults: LocationOption[];
  locationSearch: string;
  paymentMethods: PaymentMethod[];
  postalCodes: PostalCodeOption[];
  province: string;
  provinceOptions: string[];
  selectedLocation: LocationOption | null;
  subdistrictOptions: LocationOption[];
  open: boolean;
  onClose: () => void;
  onCheckoutOpen: () => void;
  onCheckoutFormChange: React.Dispatch<React.SetStateAction<typeof emptyCheckout>>;
  onCreatePayment: () => void | Promise<void>;
  onFetchOrder: () => void | Promise<void>;
  onGuidedCityChange: (value: string) => void;
  onLocationModeChange: (value: LocationMode) => void;
  onLocationSearchChange: (value: string) => void;
  onPostalCodeChange: (value: string) => void;
  onProvinceChange: (value: string) => void;
  onSelectLocation: (location: LocationOption) => void;
  onRemove: (item: CartItem) => void | Promise<void>;
  onRunCheckout: () => void | Promise<void>;
  onUpdate: (item: CartItem, quantity: number) => void | Promise<void>;
}

function CartDrawer({
  cart,
  checkoutForm,
  checkoutOpen,
  busyAction,
  orderSecret,
  orderPaymentUrl,
  cityOptions,
  guidedCity,
  locationLoading,
  locationMode,
  locationNotice,
  locationResults,
  locationSearch,
  paymentMethods,
  postalCodes,
  province,
  provinceOptions,
  selectedLocation,
  subdistrictOptions,
  open,
  onClose,
  onCheckoutOpen,
  onCheckoutFormChange,
  onCreatePayment,
  onFetchOrder,
  onGuidedCityChange,
  onLocationModeChange,
  onLocationSearchChange,
  onPostalCodeChange,
  onProvinceChange,
  onSelectLocation,
  onRemove,
  onRunCheckout,
  onUpdate
}: CartDrawerProps) {
  return (
    <div className={open ? "drawer-backdrop visible" : "drawer-backdrop"} aria-hidden={!open}>
      <aside className="shop-drawer cart-drawer" aria-label="Shopping cart">
        <div className="drawer-head">
          <div>
            <p className="store-kicker">Bag</p>
            <h2>Your cart</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close cart">
            <X size={22} />
          </button>
        </div>

        <div className="cart-items" data-testid="cart-items">
          {cart?.items?.length ? (
            cart.items.map((item) => (
              <div className="cart-line" key={String(item.id)}>
                <div className="cart-line-copy">
                  <strong>{cartItemTitle(item)}</strong>
                  <span>{itemLinePrice(item)}</span>
                </div>
                <div className="cart-line-controls">
                  <button onClick={() => void onUpdate(item, Number(item.quantity || 1) - 1)} aria-label="Decrease">
                    <Minus size={16} />
                  </button>
                  <span>{item.quantity}</span>
                  <button onClick={() => void onUpdate(item, Number(item.quantity || 1) + 1)} aria-label="Increase">
                    <Plus size={16} />
                  </button>
                  <button onClick={() => void onRemove(item)} aria-label="Remove">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <ShoppingBag size={28} />
              <p>Your cart is empty.</p>
              <span>Add a product to start checkout.</span>
            </div>
          )}
        </div>

        <div className="cart-summary">
          <div>
            <span>Subtotal</span>
            <strong>{cartTotal(cart)}</strong>
          </div>
          <button className="checkout-button" onClick={onCheckoutOpen} disabled={!cartItemCount(cart)}>
            <CreditCard size={19} />
            Checkout
          </button>
        </div>

        {checkoutOpen ? (
          <div className="checkout-panel">
            <h3>Delivery details</h3>
            <div className="form-grid">
              {CHECKOUT_FIELDS.map((key) => (
                <label key={key}>
                  <span>{checkoutLabel(key)}</span>
                  <input
                    value={checkoutForm[key]}
                    onChange={(event) =>
                      onCheckoutFormChange((current) => ({ ...current, [key]: event.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
            <LocationPicker
              cityOptions={cityOptions}
              guidedCity={guidedCity}
              locationLoading={locationLoading}
              locationMode={locationMode}
              locationNotice={locationNotice}
              locationResults={locationResults}
              locationSearch={locationSearch}
              postalCode={checkoutForm.postalCode}
              postalCodes={postalCodes}
              province={province}
              provinceOptions={provinceOptions}
              selectedLocation={selectedLocation}
              subdistrictOptions={subdistrictOptions}
              onGuidedCityChange={onGuidedCityChange}
              onLocationModeChange={onLocationModeChange}
              onLocationSearchChange={onLocationSearchChange}
              onPostalCodeChange={onPostalCodeChange}
              onProvinceChange={onProvinceChange}
              onSelectLocation={onSelectLocation}
            />
            <div className="payment-methods" role="radiogroup" aria-label="Payment method">
              <span>Payment</span>
              {paymentMethods.map((method) => (
                <button
                  key={method.code}
                  className={checkoutForm.paymentMethod === method.code ? "payment-card active" : "payment-card"}
                  onClick={() => onCheckoutFormChange((current) => ({ ...current, paymentMethod: method.code }))}
                  type="button"
                >
                  <CreditCard size={20} />
                  <span>
                    <strong>{method.label || formatPaymentCode(method.code)}</strong>
                    <small>{paymentMethodDescription(method)}</small>
                  </span>
                </button>
              ))}
            </div>
            <button
              className="checkout-button"
              onClick={() => void onRunCheckout()}
              disabled={busyAction === "checkout"}
              data-testid="guest-checkout"
            >
              {busyAction === "checkout" ? <Loader2 size={18} className="spin" /> : <CreditCard size={18} />}
              Place order
            </button>
            {orderSecret ? (
              <div className="order-confirmation">
                <span>Order placed</span>
                <strong>{orderSecret}</strong>
                <div>
                  <button onClick={() => void onFetchOrder()}>Order status</button>
                  {orderPaymentUrl ? (
                    <a href={orderPaymentUrl} target="_blank" rel="noreferrer">
                      Continue to payment
                    </a>
                  ) : (
                    <button onClick={() => void onCreatePayment()} disabled={busyAction === "payment"}>
                      Prepare payment
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

interface LocationPickerProps {
  cityOptions: string[];
  guidedCity: string;
  locationLoading: boolean;
  locationMode: LocationMode;
  locationNotice: string;
  locationResults: LocationOption[];
  locationSearch: string;
  postalCode: string;
  postalCodes: PostalCodeOption[];
  province: string;
  provinceOptions: string[];
  selectedLocation: LocationOption | null;
  subdistrictOptions: LocationOption[];
  onGuidedCityChange: (value: string) => void;
  onLocationModeChange: (value: LocationMode) => void;
  onLocationSearchChange: (value: string) => void;
  onPostalCodeChange: (value: string) => void;
  onProvinceChange: (value: string) => void;
  onSelectLocation: (location: LocationOption) => void;
}

function LocationPicker({
  cityOptions,
  guidedCity,
  locationLoading,
  locationMode,
  locationNotice,
  locationResults,
  locationSearch,
  postalCode,
  postalCodes,
  province,
  provinceOptions,
  selectedLocation,
  subdistrictOptions,
  onGuidedCityChange,
  onLocationModeChange,
  onLocationSearchChange,
  onPostalCodeChange,
  onProvinceChange,
  onSelectLocation
}: LocationPickerProps) {
  return (
    <div className="delivery-area">
      <span>Delivery area</span>
      <div className="mode-switch" role="tablist" aria-label="Delivery area mode">
        <button
          className={locationMode === "guided" ? "active" : ""}
          type="button"
          onClick={() => onLocationModeChange("guided")}
        >
          Province / city / district
        </button>
        <button
          className={locationMode === "search" ? "active" : ""}
          type="button"
          onClick={() => onLocationModeChange("search")}
        >
          Search subdistrict
        </button>
      </div>

      {locationMode === "guided" ? (
        <div className="location-grid">
          <label>
            <span>Province</span>
            <select value={province} onChange={(event) => onProvinceChange(event.target.value)}>
              {provinceOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>City</span>
            <select
              value={guidedCity}
              onChange={(event) => onGuidedCityChange(event.target.value)}
              disabled={!cityOptions.length || locationLoading}
            >
              {cityOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>District</span>
            <select
              value={selectedLocation?.id || ""}
              onChange={(event) => {
                const location = subdistrictOptions.find((item) => String(item.id) === event.target.value);
                if (location) onSelectLocation(location);
              }}
              disabled={!subdistrictOptions.length || locationLoading}
            >
              {subdistrictOptions.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.subdistrict_name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="location-search">
          <label>
            <span>Subdistrict</span>
            <input value={locationSearch} onChange={(event) => onLocationSearchChange(event.target.value)} />
          </label>
          {locationResults.length ? (
            <div className="location-results">
              {locationResults.map((location) => (
                <button
                  className={selectedLocation?.id === location.id ? "active" : ""}
                  key={location.id}
                  type="button"
                  onClick={() => onSelectLocation(location)}
                >
                  {location.display}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}

      <label>
        <span>Postal code</span>
        {postalCodes.length ? (
          <select value={postalCode} onChange={(event) => onPostalCodeChange(event.target.value)}>
            {postalCodes.map((item) => (
              <option key={item.id} value={item.postal_code}>
                {item.postal_code}
              </option>
            ))}
          </select>
        ) : (
          <input value={postalCode} onChange={(event) => onPostalCodeChange(event.target.value)} />
        )}
      </label>

      {selectedLocation ? <p>{selectedLocation.display}</p> : null}
      {locationNotice ? <p className="location-notice">{locationNotice}</p> : null}
    </div>
  );
}

interface QuickViewProps {
  availability: string;
  busyAction: string | null;
  onAdd: () => void | Promise<void>;
  onClose: () => void;
  onQuantityChange: React.Dispatch<React.SetStateAction<number>>;
  onVariantChange: (variantId: number) => void;
  open: boolean;
  product: Product | null;
  quantity: number;
  selectedVariant: ProductVariant | null;
}

function QuickView({
  availability,
  busyAction,
  onAdd,
  onClose,
  onQuantityChange,
  onVariantChange,
  open,
  product,
  quantity,
  selectedVariant
}: QuickViewProps) {
  if (!product) return null;

  return (
    <div className={open ? "modal-backdrop visible" : "modal-backdrop"} aria-hidden={!open}>
      <section className="quick-view" data-testid="product-detail">
        <button className="close-button" onClick={onClose} aria-label="Close product details">
          <X size={22} />
        </button>
        <div className="quick-media">
          {productImage(product) ? (
            <img src={productImage(product)!} alt={product.name} />
          ) : (
            <div className="image-fallback">{product.name.slice(0, 2)}</div>
          )}
        </div>
        <div className="quick-copy">
          <p className="store-kicker">{product.item_type || "Product"}</p>
          <h2>{product.name}</h2>
          <p className="price-line">{money(selectedVariant?.price || product.price_range?.min, selectedVariant?.currency || "IDR")}</p>
          <p className="product-description">
            {product.description || product.rich_description || "Selected from this week's curated collection."}
          </p>
          <div className="variant-list">
            {product.variants?.map((variant) => (
              <button
                className={variant.id === selectedVariant?.id ? "variant-option active" : "variant-option"}
                key={variant.id}
                onClick={() => onVariantChange(variant.id)}
              >
                <span>{variantLabel(variant)}</span>
                <strong>{money(variant.price, variant.currency || "IDR")}</strong>
              </button>
            ))}
          </div>
          <p className="stock-note">{availability || "Checking availability"}</p>
          <div className="buy-row">
            <div className="stepper" aria-label="Quantity">
              <button onClick={() => onQuantityChange((value) => Math.max(1, value - 1))}>
                <Minus size={16} />
              </button>
              <span>{quantity}</span>
              <button onClick={() => onQuantityChange((value) => value + 1)}>
                <Plus size={16} />
              </button>
            </div>
            <button
              className="checkout-button"
              onClick={() => void onAdd()}
              disabled={!selectedVariant || busyAction === `add-${selectedVariant?.id}`}
              data-testid="add-to-cart"
            >
              <ShoppingCart size={19} />
              Add to cart
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

interface AccountDrawerProps {
  accountMode: AccountMode;
  busyAction: string | null;
  customerEmail: string;
  customerOutput: string;
  customerPassword: string;
  customerToken: string;
  otpRequested: boolean;
  resetPassword: string;
  resetPasswordConfirm: string;
  resetToken: string;
  onCallCustomerEndpoint: (label: string, path: string) => void | Promise<void>;
  onClose: () => void;
  onEmailChange: (value: string) => void;
  onLogout: () => void | Promise<void>;
  onModeChange: (value: AccountMode) => void;
  onOtpChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRefresh: () => void | Promise<void>;
  onRequestPasswordReset: () => void | Promise<void>;
  onResetPasswordConfirmChange: (value: string) => void;
  onResetPasswordChange: (value: string) => void;
  onSavePasswordReset: () => void | Promise<void>;
  onStartCustomerLogin: () => void | Promise<void>;
  onVerifyOtp: () => void | Promise<void>;
  open: boolean;
  otpCode: string;
}

function AccountDrawer({
  accountMode,
  busyAction,
  customerEmail,
  customerOutput,
  customerPassword,
  customerToken,
  otpRequested,
  resetPassword,
  resetPasswordConfirm,
  resetToken,
  onCallCustomerEndpoint,
  onClose,
  onEmailChange,
  onLogout,
  onModeChange,
  onOtpChange,
  onPasswordChange,
  onRefresh,
  onRequestPasswordReset,
  onResetPasswordConfirmChange,
  onResetPasswordChange,
  onSavePasswordReset,
  onStartCustomerLogin,
  onVerifyOtp,
  open,
  otpCode
}: AccountDrawerProps) {
  return (
    <div className={open ? "drawer-backdrop visible" : "drawer-backdrop"} aria-hidden={!open}>
      <aside className="shop-drawer account-drawer" aria-label="Customer account">
        <div className="drawer-head">
          <div>
            <p className="store-kicker">Account</p>
            <h2>{customerToken ? "Welcome back" : accountMode === "login" ? "Sign in" : "Reset password"}</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close account">
            <X size={22} />
          </button>
        </div>
        {!customerToken ? (
          <div className="mode-switch account-mode-switch" role="tablist" aria-label="Account mode">
            <button
              className={accountMode === "login" ? "active" : ""}
              type="button"
              onClick={() => onModeChange("login")}
            >
              Sign in
            </button>
            <button
              className={accountMode === "reset" ? "active" : ""}
              type="button"
              onClick={() => onModeChange("reset")}
            >
              Reset password
            </button>
          </div>
        ) : null}
        {customerToken ? (
          <div className="account-actions account-actions-stacked">
            <button onClick={() => void onCallCustomerEndpoint("Account details", "customers/me")}>
              Account details
            </button>
            <button onClick={() => void onCallCustomerEndpoint("Order history", "customers/me/orders")}>
              Order history
            </button>
            <button onClick={() => void onCallCustomerEndpoint("Memberships", "customers/me/subscriptions")}>
              Memberships
            </button>
            <button onClick={() => void onRefresh()}>Keep me signed in</button>
            <button className="danger-text" onClick={() => void onLogout()}>
              Sign out
            </button>
          </div>
        ) : accountMode === "login" ? (
          <>
            <div className="form-grid">
              <label>
                <span>Email</span>
                <input value={customerEmail} onChange={(event) => onEmailChange(event.target.value)} />
              </label>
              <label>
                <span>Password</span>
                <input
                  type="password"
                  value={customerPassword}
                  onChange={(event) => onPasswordChange(event.target.value)}
                />
              </label>
              {otpRequested ? (
                <label>
                  <span>One-time code</span>
                  <input value={otpCode} onChange={(event) => onOtpChange(event.target.value)} />
                </label>
              ) : null}
            </div>
            <div className="account-actions">
              <button
                className="checkout-button"
                onClick={() => void onStartCustomerLogin()}
                disabled={busyAction === "otp"}
              >
                {busyAction === "otp" ? (
                  <Loader2 size={18} className="spin" />
                ) : otpRequested ? (
                  <Mail size={18} />
                ) : (
                  <LogIn size={18} />
                )}
                {otpRequested ? "Resend code" : "Sign in"}
              </button>
              {otpRequested ? (
                <button
                  className="checkout-button"
                  onClick={() => void onVerifyOtp()}
                  disabled={busyAction === "otp-verify"}
                >
                  {busyAction === "otp-verify" ? <Loader2 size={17} className="spin" /> : <LogIn size={17} />}
                  Verify code
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <>
            {resetToken ? (
              <>
                <div className="form-grid">
                  <label>
                    <span>New password</span>
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(event) => onResetPasswordChange(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Confirm password</span>
                    <input
                      type="password"
                      value={resetPasswordConfirm}
                      onChange={(event) => onResetPasswordConfirmChange(event.target.value)}
                    />
                  </label>
                </div>
                <div className="account-actions">
                  <button
                    className="checkout-button"
                    onClick={() => void onSavePasswordReset()}
                    disabled={busyAction === "save-password"}
                  >
                    {busyAction === "save-password" ? <Loader2 size={17} className="spin" /> : <KeyRound size={17} />}
                    Save password
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="form-grid">
                  <label>
                    <span>Email</span>
                    <input value={customerEmail} onChange={(event) => onEmailChange(event.target.value)} />
                  </label>
                </div>
                <div className="account-actions">
                  <button
                    className="checkout-button"
                    onClick={() => void onRequestPasswordReset()}
                    disabled={busyAction === "forget-password"}
                  >
                    {busyAction === "forget-password" ? <Loader2 size={18} className="spin" /> : <Mail size={18} />}
                    Send reset email
                  </button>
                </div>
              </>
            )}
          </>
        )}
        {customerOutput ? <p className="account-note">{customerOutput}</p> : null}
      </aside>
    </div>
  );
}

function cartItemTitle(item: CartItem): string {
  const variant = item.variant;
  const product = item.product || variant?.product;
  const directName = item.product_name || item.variant_name;
  if (typeof directName === "string") return directName;
  return product?.name || variant?.fullname || `Item ${item.id}`;
}

function itemLinePrice(item: CartItem): string {
  const lineSubtotal = item.line_subtotal;
  if (typeof lineSubtotal === "string") return money(lineSubtotal);
  return item.subtotal || item.total ? money(String(item.subtotal || item.total)) : "";
}

function checkoutLabel(key: string): string {
  if (key === "postalCode") return "Postal code";
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function provinceOptionId(province?: ProvinceOption): number | null {
  return province?.province_id || province?.ro_province_id || null;
}

function cityOptionId(city?: CityOption): number | null {
  return city?.city_id || city?.ro_city_id || null;
}

function formatPaymentCode(code: string): string {
  return code.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function paymentMethodDescription(method: PaymentMethod): string {
  if (typeof method.description === "string") return method.description;
  if (method.code === "cod") return "Pay when your order arrives.";
  if (method.code === "bank_transfer") return "Place the order now and receive payment instructions.";
  if (method.requires_redirect) return `Continue to ${method.label || formatPaymentCode(method.code)} after placing the order.`;
  return "Available for this store.";
}

function findToken(
  data: Record<string, unknown>,
  candidates = ["access", "access_token", "accessToken", "customer_access_token", "token", "jwt"]
): string | null {
  for (const key of candidates) {
    const value = data[key];
    if (typeof value === "string") return value;
  }
  for (const value of Object.values(data)) {
    if (value && typeof value === "object") {
      const nested = findToken(value as Record<string, unknown>, candidates);
      if (nested) return nested;
    }
  }
  return null;
}

function findRefreshToken(data: Record<string, unknown>): string | null {
  return findToken(data, ["refresh", "refresh_token", "refreshToken", "customer_refresh_token"]);
}

function findSecretSlug(data: Record<string, unknown>): string | null {
  const candidates = ["secret_slug", "secretSlug", "public_order_secret_slug", "order_secret_slug"];
  for (const key of candidates) {
    const value = data[key];
    if (typeof value === "string") return value;
  }
  for (const value of Object.values(data)) {
    if (value && typeof value === "object") {
      const nested = findSecretSlug(value as Record<string, unknown>);
      if (nested) return nested;
    }
  }
  return null;
}

function findPaymentUrl(data: Record<string, unknown>): string | null {
  const candidates = ["payment_url", "paymentUrl", "checkout_url", "checkoutUrl"];
  for (const key of candidates) {
    const value = data[key];
    if (typeof value === "string" && /^https?:\/\//.test(value)) return value;
  }
  for (const value of Object.values(data)) {
    if (value && typeof value === "object") {
      const nested = findPaymentUrl(value as Record<string, unknown>);
      if (nested) return nested;
    }
  }
  return null;
}

function initialResetToken(): string {
  if (typeof window === "undefined") return "";
  return findResetToken(new URLSearchParams(window.location.search)) || findResetToken(hashParams()) || "";
}

function clearResetTokenFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const key of resetTokenParamNames) {
    url.searchParams.delete(key);
  }
  const cleanedHash = cleanHashResetToken(url.hash);
  if (cleanedHash !== url.hash) {
    url.hash = cleanedHash;
  }
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}

function findResetToken(params: URLSearchParams): string {
  for (const key of resetTokenParamNames) {
    const token = params.get(key);
    if (token) return token;
  }
  return "";
}

function hashParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  const hash = window.location.hash.replace(/^#\/?/, "");
  const queryStart = hash.indexOf("?");
  return new URLSearchParams(queryStart >= 0 ? hash.slice(queryStart + 1) : hash);
}

function cleanHashResetToken(hash: string): string {
  if (!hash) return hash;
  const rawHash = hash.slice(1);
  const queryStart = rawHash.indexOf("?");
  const hashPath = queryStart >= 0 ? rawHash.slice(0, queryStart) : "";
  const hashQuery = queryStart >= 0 ? rawHash.slice(queryStart + 1) : rawHash;
  const params = new URLSearchParams(hashQuery);
  let hadResetToken = false;
  for (const key of resetTokenParamNames) {
    if (params.has(key)) hadResetToken = true;
    params.delete(key);
  }
  if (!hadResetToken) return hash;
  const nextQuery = params.toString();
  if (hashPath) return nextQuery ? `#${hashPath}?${nextQuery}` : `#${hashPath}`;
  return nextQuery ? `#?${nextQuery}` : "";
}

const resetTokenParamNames = ["token", "reset_token", "password_reset_token", "customer_reset_token"];
