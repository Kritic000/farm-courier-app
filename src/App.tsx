import React, { useEffect, useState } from "react";

const API_URL = "https://script.google.com/macros/s/AKfycbyDUCZXyBtqO6jKn3HSr7v7Wi2Y4AJ_BT_mRmJbY7Er0Ex0Ise1GrGMhLyDCUfZmNw/exec";
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
};

export default function App() {
  const [tab, setTab] = useState<"active" | "done">("active");
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [doneOrders, setDoneOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

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
        setActiveOrders(data.orders || []);
      } else {
        setDoneOrders(data.orders || []);
      }
    } catch (e) {
      console.error(e);
      alert("Не удалось загрузить заказы");
    } finally {
      setLoading(false);
    }
  }

  function call(phone: string) {
    if (!phone) return;
    window.location.href = `tel:${phone}`;
  }

  function openMap(address: string) {
    if (!address) return;
    window.open(
      `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`,
      "_blank"
    );
  }

  function openTelegram(username?: string, userId?: string) {
    if (username) {
      window.open(`https://t.me/${username}`, "_blank");
      return;
    }

    if (userId) {
      window.open(`https://t.me/user?id=${userId}`, "_blank");
    }
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

  const orders = tab === "active" ? activeOrders : doneOrders;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>Курьер</div>

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
                  onClick={() => openMap(o.address)}
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
  header: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 16,
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
