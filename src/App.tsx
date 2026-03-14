import React, { useEffect, useMemo, useState } from "react";

const API_URL =
  "https://script.google.com/macros/s/AKfycbxKXAVN8SbZ_DoY-k743zaDAGlzgfdhga_x_IWkxsyyDHvTIUIhLOhLApqJzFFs3Wg/exec";
const API_TOKEN = "Kjhytccb18@";

type Order = {
  createdAt?: string;
  orderId: string;
  name: string;
  phone: string;
  tgUserId?: string;
  tgUsername?: string;
  address: string;
  normalizedAddress?: string;
  itemsText?: string;
  notes?: string;
  total: number;
  status?: string;
  lat?: string;
  lon?: string;
  geocodedAddress?: string;
};

const COLORS = {
  olive: "#606c38",
  darkOlive: "#283618",
  cream: "#fefae0",
  sand: "#dda15e",
  brown: "#bc6c25",
};

export default function App() {
  const [tab, setTab] = useState<"active" | "archive">("active");
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [archiveOrders, setArchiveOrders] = useState<Order[]>([]);
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
        setArchiveOrders(Array.isArray(data.orders) ? data.orders : []);
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

  function openExternalLink(url: string) {
    const tg = getTelegramWebApp();

    try {
      if (tg?.openLink) {
        tg.openLink(url);
        return;
      }
    } catch (e) {
      console.warn("tg.openLink failed:", e);
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

    alert("У клиента не указан Telegram");
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
        `Координаты обновлены.\nОбработано: ${data?.updated || 0}\nНе найдено: ${data?.failed || 0}\nПропущено: ${data?.skipped || 0}`
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

  function formatWeekLabel(createdAt?: string) {
    if (!createdAt) return "—";

    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return createdAt;

    return d.toLocaleDateString("ru-RU");
  }

  function formatMoney(value: unknown) {
    const n = Number(value);

    if (!Number.isFinite(n)) return "0 ₽";

    const rounded = Math.round(n);

    return `${rounded.toLocaleString("ru-RU")} ₽`;
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

  async function openSingleClientRoute(order: Order) {
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

      openYandexRoute([
        { lat: pos.lat, lon: pos.lon },
        { lat: lat!, lon: lon! },
      ]);
    } catch (e) {
      console.error(e);
      alert("Не удалось получить текущее местоположение");
    }
  }

  const orders = tab === "active" ? activeOrders : archiveOrders;

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
      <div style={styles.backgroundGlowTop} />
      <div style={styles.backgroundGlowBottom} />

      <div style={styles.container}>
        <div style={styles.heroCard}>
          <div style={styles.heroTop}>
            <div>
              <div style={styles.kicker}>Farm Courier</div>
              <div style={styles.header}>Курьер</div>
            </div>

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

          <div style={styles.heroSubtext}>
            Управление активными доставками и архивом заказов
          </div>
        </div>

        {tab === "active" && (
          <div style={styles.toolsCard}>
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
          </div>
        )}

        <div style={styles.tabsShell}>
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
                ...(tab === "archive" ? styles.tabBtnActive : {}),
              }}
              onClick={() => setTab("archive")}
            >
              Архив
            </button>
          </div>
        </div>

        {loading ? (
          <div style={styles.info}>Загрузка…</div>
        ) : orders.length === 0 ? (
          <div style={styles.info}>
            {tab === "active"
              ? "Активных заказов на текущую неделю нет"
              : "Архив пока пуст"}
          </div>
        ) : (
          orders.map((o, index) => (
            <div key={`${o.orderId}-${o.createdAt || ""}-${index}`} style={styles.card}>
              <div style={styles.cardTop}>
                <div style={styles.cardBadge}>Заказ</div>
                <div style={styles.cardWeek}>{formatWeekLabel(o.createdAt)}</div>
              </div>

              <div style={styles.cardTitleRow}>
                <div style={styles.cardTitle}>№ {o.orderId || "—"}</div>
                <div style={styles.cardPrice}>{formatMoney(o.total)}</div>
              </div>

              <div style={styles.metaGrid}>
                <div style={styles.metaItem}>
                  <div style={styles.metaLabel}>Имя</div>
                  <div style={styles.metaValue}>{o.name || "—"}</div>
                </div>

                <div style={styles.metaItem}>
                  <div style={styles.metaLabel}>Телефон</div>
                  <div style={styles.metaValue}>{o.phone || "—"}</div>
                </div>
              </div>

              <div style={styles.addressPanel}>
                <div style={styles.panelLabel}>Адрес</div>
                <div style={styles.addressValue}>{o.address || "—"}</div>
              </div>

              {o.itemsText ? (
                <div style={styles.itemsBox}>
                  <div style={styles.panelLabel}>Состав заказа</div>
                  <div style={styles.panelText}>{o.itemsText}</div>
                </div>
              ) : null}

              {o.notes ? (
                <div style={styles.notesBox}>
                  <div style={styles.panelLabel}>Примечание</div>
                  <div style={styles.panelText}>{o.notes}</div>
                </div>
              ) : null}

              <div style={styles.coordsBox}>
                <div style={styles.panelLabel}>Координаты</div>

                <div style={styles.coordRow}>
                  <span style={styles.coordKey}>lat</span>
                  <span style={styles.coordValue}>{o.lat || "—"}</span>
                </div>

                <div style={styles.coordRow}>
                  <span style={styles.coordKey}>lon</span>
                  <span style={styles.coordValue}>{o.lon || "—"}</span>
                </div>

                {o.geocodedAddress ? (
                  <div style={styles.geoHint}>
                    Геокод найден как: {o.geocodedAddress}
                  </div>
                ) : null}
              </div>

              <div style={styles.actions}>
                <button style={styles.primaryActionBtn} onClick={() => call(o.phone)}>
                  Позвонить
                </button>

                <button
                  style={styles.secondaryActionBtn}
                  onClick={() => openTelegram(o.tgUsername, o.tgUserId)}
                >
                  Telegram
                </button>

                <button
                  style={styles.secondaryActionBtn}
                  onClick={() => openSingleClientRoute(o)}
                >
                  Маршрут
                </button>

                <button
                  style={styles.secondaryActionBtn}
                  onClick={() => copySingleClientRoute(o)}
                >
                  Скопировать ссылку
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
                <div style={styles.archiveLabel}>В архиве</div>
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
    background: `linear-gradient(180deg, ${COLORS.darkOlive} 0%, #364722 35%, ${COLORS.cream} 100%)`,
    padding: 16,
    fontFamily: "Arial, sans-serif",
    boxSizing: "border-box",
    color: COLORS.darkOlive,
    position: "relative",
    overflowX: "hidden",
  },
  backgroundGlowTop: {
    position: "fixed",
    top: -120,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: "50%",
    background: "rgba(221,161,94,0.18)",
    filter: "blur(40px)",
    pointerEvents: "none",
  },
  backgroundGlowBottom: {
    position: "fixed",
    bottom: -120,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: "50%",
    background: "rgba(188,108,37,0.12)",
    filter: "blur(50px)",
    pointerEvents: "none",
  },
  container: {
    maxWidth: 680,
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
  },
  heroCard: {
    background: "rgba(254,250,224,0.12)",
    border: "1px solid rgba(254,250,224,0.14)",
    borderRadius: 28,
    padding: 18,
    marginBottom: 14,
    backdropFilter: "blur(10px)",
    boxShadow: "0 18px 44px rgba(0,0,0,0.18)",
  },
  heroTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  kicker: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: COLORS.sand,
    marginBottom: 6,
  },
  header: {
    fontSize: 30,
    fontWeight: 800,
    color: COLORS.cream,
    lineHeight: 1.05,
    letterSpacing: 0.2,
  },
  heroSubtext: {
    marginTop: 10,
    color: "rgba(254,250,224,0.82)",
    fontSize: 14,
    lineHeight: 1.45,
  },
  headerBtns: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  refreshBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(254,250,224,0.16)",
    background: "rgba(254,250,224,0.08)",
    color: COLORS.cream,
    cursor: "pointer",
    fontWeight: 700,
    boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
  },
  geoBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: `1px solid ${COLORS.sand}`,
    background: `linear-gradient(180deg, ${COLORS.sand} 0%, ${COLORS.brown} 100%)`,
    color: COLORS.cream,
    cursor: "pointer",
    fontWeight: 800,
    boxShadow: "0 10px 18px rgba(188,108,37,0.24)",
  },
  toolsCard: {
    background: COLORS.cream,
    borderRadius: 24,
    padding: 14,
    marginBottom: 14,
    border: `1px solid rgba(188,108,37,0.18)`,
    boxShadow: "0 18px 36px rgba(40,54,24,0.14)",
  },
  routeAllBtn: {
    width: "100%",
    marginBottom: 10,
    padding: "14px 16px",
    borderRadius: 18,
    border: "none",
    background: `linear-gradient(180deg, ${COLORS.darkOlive} 0%, ${COLORS.olive} 100%)`,
    color: COLORS.cream,
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 15,
    boxShadow: "0 14px 22px rgba(40,54,24,0.22)",
  },
  copyRouteBtn: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 18,
    border: `1px solid ${COLORS.sand}`,
    background: "#fffdf5",
    color: COLORS.brown,
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 15,
    boxShadow: "0 8px 16px rgba(40,54,24,0.08)",
  },
  tabsShell: {
    background: "rgba(254,250,224,0.14)",
    borderRadius: 22,
    padding: 6,
    marginBottom: 16,
    boxShadow: "0 12px 26px rgba(0,0,0,0.14)",
    backdropFilter: "blur(8px)",
  },
  tabs: {
    display: "flex",
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    padding: "13px 14px",
    borderRadius: 16,
    border: "1px solid transparent",
    background: "rgba(254,250,224,0.08)",
    color: COLORS.cream,
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 15,
  },
  tabBtnActive: {
    background: COLORS.cream,
    color: COLORS.darkOlive,
    boxShadow: "0 10px 18px rgba(0,0,0,0.12)",
  },
  info: {
    background: COLORS.cream,
    borderRadius: 22,
    padding: 18,
    border: `1px solid rgba(188,108,37,0.16)`,
    color: COLORS.darkOlive,
    boxShadow: "0 14px 28px rgba(40,54,24,0.12)",
  },
  card: {
    background: "rgba(254,250,224,0.98)",
    borderRadius: 28,
    padding: 16,
    marginBottom: 16,
    border: `1px solid rgba(188,108,37,0.18)`,
    boxShadow: "0 20px 40px rgba(40,54,24,0.14)",
    color: COLORS.darkOlive,
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    background: "rgba(96,108,56,0.1)",
    color: COLORS.olive,
  },
  cardWeek: {
    fontSize: 13,
    fontWeight: 700,
    color: COLORS.brown,
  },
  cardTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: 800,
    color: COLORS.darkOlive,
    lineHeight: 1,
  },
  cardPrice: {
    fontSize: 22,
    fontWeight: 800,
    color: COLORS.brown,
    whiteSpace: "nowrap",
  },
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 12,
  },
  metaItem: {
    background: "#fffdf6",
    borderRadius: 18,
    padding: 12,
    border: `1px solid rgba(221,161,94,0.3)`,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: COLORS.olive,
    marginBottom: 6,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: 700,
    color: COLORS.darkOlive,
    lineHeight: 1.35,
    wordBreak: "break-word",
  },
  addressPanel: {
    marginTop: 2,
    marginBottom: 12,
    padding: 14,
    borderRadius: 20,
    background: `linear-gradient(180deg, rgba(221,161,94,0.12) 0%, rgba(254,250,224,0.8) 100%)`,
    border: `1px solid rgba(221,161,94,0.35)`,
  },
  addressValue: {
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1.45,
    color: COLORS.darkOlive,
  },
  panelLabel: {
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.9,
    color: COLORS.olive,
    marginBottom: 8,
  },
  panelText: {
    whiteSpace: "pre-wrap",
    fontSize: 15,
    lineHeight: 1.45,
    color: COLORS.darkOlive,
  },
  itemsBox: {
    marginTop: 10,
    padding: 14,
    borderRadius: 20,
    background: "#f8f2dc",
    border: `1px solid rgba(221,161,94,0.28)`,
  },
  notesBox: {
    marginTop: 10,
    padding: 14,
    borderRadius: 20,
    background: "#f8ead7",
    border: `1px solid rgba(188,108,37,0.32)`,
  },
  coordsBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: 20,
    background: "#f4efd9",
    border: `1px solid rgba(221,161,94,0.24)`,
  },
  coordRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 1.4,
  },
  coordKey: {
    fontWeight: 800,
    color: COLORS.olive,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  coordValue: {
    fontWeight: 700,
    color: COLORS.darkOlive,
    textAlign: "right",
    wordBreak: "break-all",
  },
  geoHint: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 1.4,
    color: COLORS.brown,
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 14,
  },
  primaryActionBtn: {
    padding: "12px 14px",
    borderRadius: 16,
    border: "none",
    background: `linear-gradient(180deg, ${COLORS.brown} 0%, #9f561d 100%)`,
    color: COLORS.cream,
    cursor: "pointer",
    fontWeight: 800,
    boxShadow: "0 12px 18px rgba(188,108,37,0.22)",
  },
  secondaryActionBtn: {
    padding: "12px 14px",
    borderRadius: 16,
    border: `1px solid rgba(221,161,94,0.45)`,
    background: "#fffdf6",
    color: COLORS.darkOlive,
    cursor: "pointer",
    fontWeight: 800,
    boxShadow: "0 6px 12px rgba(40,54,24,0.06)",
  },
  doneBtn: {
    marginTop: 14,
    width: "100%",
    padding: "14px 16px",
    borderRadius: 18,
    border: "none",
    background: `linear-gradient(180deg, ${COLORS.olive} 0%, ${COLORS.darkOlive} 100%)`,
    color: COLORS.cream,
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 15,
    boxShadow: "0 14px 22px rgba(40,54,24,0.22)",
  },
  archiveLabel: {
    marginTop: 14,
    width: "100%",
    padding: "13px 14px",
    borderRadius: 18,
    background: `linear-gradient(180deg, ${COLORS.sand} 0%, ${COLORS.brown} 100%)`,
    color: COLORS.cream,
    fontWeight: 800,
    textAlign: "center",
    boxShadow: "0 12px 18px rgba(188,108,37,0.2)",
  },
};
