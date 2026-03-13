import React, { useEffect, useMemo, useState } from "react";

const API_URL =
  "https://script.google.com/macros/s/AKfycbwKL0PlYsotO_byhF-CZwFcmlci0bRSb4oyYtPIXB4xbHOqh7Q0WOwJI0TRLx4_P1w/exec";
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
};

export default function App() {
  const [tab, setTab] = useState<"active" | "done">("active");
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [doneOrders, setDoneOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

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

  function call(phone: string) {
    if (!phone) {
      alert("Номер телефона не указан");
      return;
    }
    window.location.href = `tel:${phone}`;
  }

  function openTelegram(username?: string, userId?: string) {
    const cleanUsername = String(username || "").replace(/^@/, "").trim();
    const cleanUserId = String(userId || "").trim();

    if (cleanUsername) {
      window.open(`https://t.me/${cleanUsername}`, "_blank");
      return;
    }

    if (cleanUserId) {
      window.open(`https://t.me/user?id=${cleanUserId}`, "_blank");
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

      alert(`Координаты обновлены. Обработано: ${data?.updated || 0}`);
      await loadOrders();
    } catch (e) {
      console.error(e);
      alert("Не удалось получить координаты адресов");
    } finally {
      setGeocoding(false);
    }
  }

  function openSingleClientRoute(order: Order) {
    const lat = String(order.lat || "").trim();
    const lon = String(order.lon || "").trim();

    if (!lat || !lon) {
      alert("У этого заказа ещё нет координат. Сначала нажми 'Обновить координаты'.");
      return;
    }

    const url = `yandexnavi://build_route_on_map?lat_to=${lat}&lon_to=${lon}`;
    window.location.href = url;
  }

  const orders = tab === "active" ? activeOrders : doneOrders;

  const activeOrdersWithCoords = useMemo(() => {
    return activeOrders.filter(
      (o) => String(o.lat || "").trim() && String(o.lon || "").trim()
    );
  }, [activeOrders]);

  function openRouteAll() {
    if (activeOrdersWithCoords.length === 0) {
      alert("Нет активных заказов с координатами. Сначала нажми 'Обновить координаты'.");
      return;
    }

    if (activeOrdersWithCoords.length === 1) {
      openSingleClientRoute(activeOrdersWithCoords[0]);
      return;
    }

    const first = activeOrdersWithCoords[0];
    const rest = activeOrdersWithCoords.slice(1);

    const latTo = String(first.lat || "").trim();
    const lonTo = String(first.lon || "").trim();

    const viaLat = rest.map((o) => String(o.lat || "").trim()).filter(Boolean).join(",");
    const viaLon = rest.map((o) => String(o.lon || "").trim()).filter(Boolean).join(",");

    let url = `yandexnavi://build_route_on_map?lat_to=${latTo}&lon_to=${lonTo}`;

    if (viaLat && viaLon) {
      url += `&lat_via=${viaLat}&lon_via=${viaLon}`;
    }

    window.location.href = url;
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
          <button style={styles.routeAllBtn} onClick={openRouteAll}>
            🧭 Маршрут по всем активным заказам
          </button>
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
    marginBottom: 12,
    padding: "12px 14px",
    borderRadius: 12,
    border: "none",
    background: "#111827",
    color: "#fff",
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
