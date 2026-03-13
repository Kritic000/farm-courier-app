import React, { useEffect, useMemo, useState } from "react";

const API_URL =
  "https://script.google.com/macros/s/AKfycbwaCCHYw0LahmrxjDUT29iGUSRNfuzXp-VKTftOh8_Z2hQsYxX8YGaG7yRd-pfOJGk/ex";
const API_TOKEN = "Kjhytccb18@";

type Order = {
  createdAt?: string;
  orderId: string;
  name: string;
  phone: string;
  tgUserId?: string;
  tgUsername?: string;
  address: string;
  itemsText?: string;
  total: number;
  status?: string;
  lat?: string;
  lon?: string;
  geocodedAddress?: string;
};

export default function App() {
  const [tab, setTab] = useState<"active" | "done">("active");
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [doneOrders, setDoneOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [buildingRoute, setBuildingRoute] = useState(false);
  const [copyingRoute, setCopyingRoute] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [tab]);

  async function loadOrders() {
    try {
      setLoading(true);

      const action = tab === "active" ? "courierOrders" : "courierDoneOrders";
      const res = await fetch(`${API_URL}?action=${action}&token=${API_TOKEN}`);
      const data = await res.json();

      if (tab === "active") {
        setActiveOrders(Array.isArray(data.orders) ? data.orders : []);
      } else {
        setDoneOrders(Array.isArray(data.orders) ? data.orders : []);
      }
    } catch (e) {
      console.error(e);
      alert("Не удалось загрузить заказы");
    } finally {
      setLoading(false);
    }
  }

  function getTelegramWebApp(): any {
    return (window as any)?.Telegram?.WebApp ?? null;
  }

  function isTelegramMiniApp(): boolean {
    return Boolean(getTelegramWebApp());
  }

  function openExternalLink(url: string) {
    const tg = getTelegramWebApp();

    if (isTelegramMiniApp()) {
      try {
        if (tg?.openLink) {
          tg.openLink(url);
          return;
        }
      } catch (e) {
        console.warn("tg.openLink failed:", e);
      }
    }

    try {
      window.open(url, "_blank");
    } catch (e) {
      console.error("window.open failed:", e);
      window.location.href = url;
    }
  }

  async function copyText(text: string) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }

      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const ok = document.execCommand("copy");
      document.body.removeChild(textArea);

      return ok;
    } catch (e) {
      console.error("copyText failed:", e);
      return false;
    }
  }

  function call(phone: string) {
    const cleanPhone = String(phone || "").trim();

    if (!cleanPhone) {
      alert("Номер телефона не указан");
      return;
    }

    window.location.href = `tel:${cleanPhone}`;
  }

  function openTelegram(username?: string, userId?: string) {
    const cleanUsername = String(username || "").replace(/^@/, "").trim();
    const cleanUserId = String(userId || "").trim();

    if (cleanUsername) {
      openExternalLink(`https://t.me/${cleanUsername}`);
      return;
    }

    if (cleanUserId) {
      openExternalLink(`https://t.me/user?id=${cleanUserId}`);
      return;
    }

    alert("У клиента не указан Telegram username или tgUserId");
  }

  async function markDone(orderId: string) {
    const ok = window.confirm("Отметить заказ как доставленный?");
    if (!ok) return;

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          token: API_TOKEN,
          action: "completeOrder",
          orderId,
        }),
      });

      const data = await res.json();

      if (data?.error) {
        alert(data.error);
        return;
      }

      await loadOrders();
    } catch (e) {
      console.error(e);
      alert("Не удалось обновить статус");
    }
  }

  async function geocodeOrdersNow() {
    try {
      setGeocoding(true);

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          token: API_TOKEN,
          action: "geocodeOrders",
        }),
      });

      const data = await res.json();

      if (data?.error) {
        alert(data.error);
        return;
      }

      alert(
        `Координаты обновлены.\nОбработано: ${data?.updated || 0}\nНе найдено: ${data?.failed || 0}`
      );
      await loadOrders();
    } catch (e) {
      console.error(e);
      alert("Не удалось получить координаты адресов");
    } finally {
      setGeocoding(false);
    }
  }

  function parseCoord(value: unknown): number | null {
    const n = Number(String(value ?? "").replace(",", ".").trim());
    return Number.isFinite(n) ? n : null;
  }

  function isValidLatLon(lat: number | null, lon: number | null): boolean {
    if (lat === null || lon === null) return false;
    return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }

  async function getCurrentPosition(): Promise<{ lat: number; lon: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Геолокация не поддерживается"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
        },
        (err) => reject(err),
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        }
      );
    });
  }

  function toRad(v: number) {
    return (v * Math.PI) / 180;
  }

  function distanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function sortOrdersNearest(
    start: { lat: number; lon: number },
    orders: Order[]
  ): Order[] {
    const remaining = [...orders];
    const result: Order[] = [];
    let current = { lat: start.lat, lon: start.lon };

    while (remaining.length > 0) {
      let bestIndex = 0;
      let bestDistance = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const lat = parseCoord(remaining[i].lat);
        const lon = parseCoord(remaining[i].lon);

        if (!isValidLatLon(lat, lon)) continue;

        const dist = distanceMeters(current.lat, current.lon, lat!, lon!);

        if (dist < bestDistance) {
          bestDistance = dist;
          bestIndex = i;
        }
      }

      const next = remaining.splice(bestIndex, 1)[0];
      result.push(next);

      const nextLat = parseCoord(next.lat);
      const nextLon = parseCoord(next.lon);

      if (isValidLatLon(nextLat, nextLon)) {
        current = { lat: nextLat!, lon: nextLon! };
      }
    }

    return result;
  }

  function buildYandexWebRouteUrl(points: Array<{ lat: number; lon: number }>) {
    const routeText = points.map((p) => `${p.lat},${p.lon}`).join("~");
    return `https://yandex.ru/maps/?rtext=${encodeURIComponent(routeText)}&rtt=auto`;
  }

  function openYandexRoute(points: Array<{ lat: number; lon: number }>) {
    const webUrl = buildYandexWebRouteUrl(points);
    openExternalLink(webUrl);
  }

  async function copySingleClientRoute(order: Order) {
    const lat = parseCoord(order.lat);
    const lon = parseCoord(order.lon);

    if (!isValidLatLon(lat, lon)) {
      alert(
        "У этого заказа ещё нет корректных координат. Сначала нажми '📍 Координаты'."
      );
      return;
    }

    try {
      const pos = await getCurrentPosition();
      const url = buildYandexWebRouteUrl([
        { lat: pos.lat, lon: pos.lon },
        { lat: lat!, lon: lon! },
      ]);

      const copied = await copyText(url);

      if (copied) {
        alert("Ссылка на маршрут скопирована");
      } else {
        alert("Не удалось скопировать ссылку");
      }
    } catch (e) {
      console.error(e);
      alert("Не удалось получить текущее местоположение");
    }
  }

  const orders = tab === "active" ? activeOrders : doneOrders;

  const activeOrdersWithCoords = useMemo(() => {
    return activeOrders.filter((o) => {
      const lat = parseCoord(o.lat);
      const lon = parseCoord(o.lon);
      return isValidLatLon(lat, lon);
    });
  }, [activeOrders]);

  async function openRouteAll() {
    if (activeOrdersWithCoords.length === 0) {
      alert("Нет активных заказов с координатами. Сначала нажми '📍 Координаты'.");
      return;
    }

    try {
      setBuildingRoute(true);

      const pos = await getCurrentPosition();
      const sortedOrders = sortOrdersNearest(pos, activeOrdersWithCoords);

      const points = [
        { lat: pos.lat, lon: pos.lon },
        ...sortedOrders.map((o) => ({
          lat: parseCoord(o.lat)!,
          lon: parseCoord(o.lon)!,
        })),
      ];

      openYandexRoute(points);
    } catch (e) {
      console.error(e);
      alert(
        "Не удалось получить текущее местоположение. Разреши доступ к геолокации и попробуй ещё раз."
      );
    } finally {
      setBuildingRoute(false);
    }
  }

  async function copyRouteAll() {
    if (activeOrdersWithCoords.length === 0) {
      alert("Нет активных заказов с координатами. Сначала нажми '📍 Координаты'.");
      return;
    }

    try {
      setCopyingRoute(true);

      const pos = await getCurrentPosition();
      const sortedOrders = sortOrdersNearest(pos, activeOrdersWithCoords);

      const points = [
        { lat: pos.lat, lon: pos.lon },
        ...sortedOrders.map((o) => ({
          lat: parseCoord(o.lat)!,
          lon: parseCoord(o.lon)!,
        })),
      ];

      const url = buildYandexWebRouteUrl(points);
      const copied = await copyText(url);

      if (copied) {
        alert("Ссылка на маршрут по всем заказам скопирована");
      } else {
        alert("Не удалось скопировать ссылку");
      }
    } catch (e) {
      console.error(e);
      alert("Не удалось получить текущее местоположение");
    } finally {
      setCopyingRoute(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <div style={styles.header}>Курьер</div>

          <div style={styles.headerBtns}>
            <button style={styles.refreshBtn} onClick={loadOrders}>
              ↻ Обновить
            </button>

            <button
              style={styles.geoBtn}
              onClick={geocodeOrdersNow}
              disabled={geocoding}
            >
              {geocoding ? "..." : "📍 Координаты"}
            </button>
          </div>
        </div>

        {tab === "active" && (
          <>
            <button
              style={styles.routeAllBtn}
              onClick={openRouteAll}
              disabled={buildingRoute}
            >
              {buildingRoute
                ? "Строю маршрут..."
                : "🧭 Маршрут по всем активным заказам"}
            </button>

            <button
              style={styles.copyRouteBtn}
              onClick={copyRouteAll}
              disabled={copyingRoute}
            >
              {copyingRoute
                ? "Копирую..."
                : "📋 Скопировать маршрут по всем заказам"}
            </button>
          </>
        )}

        <div style={styles.tabs}>
          <button
            style={{
              ...styles.tabBtn,
              ...(tab === "active" ? styles.tabBtnActive : {}),
            }}
            onClick={() => setTab("active")}
          >
            Активные
          </button>

          <button
            style={{
              ...styles.tabBtn,
              ...(tab === "done" ? styles.tabBtnActive : {}),
            }}
            onClick={() => setTab("done")}
          >
            Доставленные
          </button>
        </div>

        {loading ? (
          <div style={styles.info}>Загрузка…</div>
        ) : orders.length === 0 ? (
          <div style={styles.info}>
            {tab === "active"
              ? "Активных заказов пока нет"
              : "Доставленных заказов пока нет"}
          </div>
        ) : (
          orders.map((o) => (
            <div key={o.orderId} style={styles.card}>
              <div style={styles.row}>
                <b>Заказ:</b> {o.orderId}
              </div>

              <div style={styles.row}>
                <b>Имя:</b> {o.name || "—"}
              </div>

              <div style={styles.row}>
                <b>Телефон:</b> {o.phone || "—"}
              </div>

              <div style={styles.row}>
                <b>Адрес:</b> {o.address || "—"}
              </div>

              <div style={styles.row}>
                <b>Сумма:</b> {o.total || 0} ₽
              </div>

              <div style={styles.row}>
                <b>lat:</b> {o.lat || "—"}
              </div>

              <div style={styles.row}>
                <b>lon:</b> {o.lon || "—"}
              </div>

              {o.geocodedAddress ? (
                <div style={styles.row}>
                  <b>Геокод найден как:</b> {o.geocodedAddress}
                </div>
              ) : null}

              {o.itemsText ? (
                <div style={styles.itemsBox}>
                  <b>Состав заказа:</b>
                  <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>
                    {o.itemsText}
                  </div>
                </div>
              ) : null}

              <div style={styles.actions}>
                <button style={styles.actionBtn} onClick={() => call(o.phone)}>
                  Позвонить
                </button>

                <button
                  style={styles.actionBtn}
                  onClick={() => openTelegram(o.tgUsername, o.tgUserId)}
                >
                  Telegram
                </button>

                <button
                  style={styles.actionBtn}
                  onClick={() => openSingleClientRoute(o)}
                >
                  Маршрут
                </button>

                <button
                  style={styles.actionBtn}
                  onClick={() => copySingleClientRoute(o)}
                >
                  📋 Скопировать ссылку
                </button>
              </div>

              {tab === "active" ? (
                <button
                  style={styles.doneBtn}
                  onClick={() => markDone(o.orderId)}
                >
                  ✅ Доставлено
                </button>
              ) : (
                <div style={styles.doneLabel}>Доставлено</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: 16,
    fontFamily: "Arial, sans-serif",
    boxSizing: "border-box",
  },
  container: {
    maxWidth: 640,
    margin: "0 auto",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  header: {
    fontSize: 28,
    fontWeight: 700,
  },
  headerBtns: {
    display: "flex",
    gap: 8,
  },
  refreshBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cfd6e4",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },
  geoBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cfd6e4",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },
  routeAllBtn: {
    width: "100%",
    marginBottom: 10,
    padding: "12px 14px",
    borderRadius: 12,
    border: "none",
    background: "#111827",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 15,
  },
  copyRouteBtn: {
    width: "100%",
    marginBottom: 12,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #cfd6e4",
    background: "#fff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 15,
  },
  tabs: {
    display: "flex",
    gap: 8,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #cfd6e4",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },
  tabBtnActive: {
    background: "#1f6feb",
    color: "#fff",
    border: "1px solid #1f6feb",
  },
  info: {
    background: "#fff",
    borderRadius: 14,
    padding: 18,
    border: "1px solid #e2e8f0",
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    border: "1px solid #e2e8f0",
    boxShadow: "0 6px 20px rgba(0,0,0,0.05)",
  },
  row: {
    marginBottom: 8,
    fontSize: 15,
    lineHeight: 1.45,
  },
  itemsBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    fontSize: 14,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  actionBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cfd6e4",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  doneBtn: {
    marginTop: 14,
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "none",
    background: "#16a34a",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 15,
  },
  doneLabel: {
    marginTop: 14,
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    background: "#dcfce7",
    color: "#166534",
    fontWeight: 700,
    textAlign: "center",
  },
};
