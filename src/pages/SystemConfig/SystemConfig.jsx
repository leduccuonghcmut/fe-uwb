import styles from "./SystemConfig.module.css";
import { useEffect, useState } from "react";
import { fetchDevices, updateDevice } from "../../service/deviceService";
import Header from "../../components/Header/Header"; // vẫn dùng header trên cùng

export default function SystemConfig() {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);

    const categories = ["Tag", "Anchor", "RTK Base"];

    // Lấy dữ liệu từ Firebase
    useEffect(() => {
        fetchDevices()
            .then((data) => setDevices(data || []))
            .finally(() => setLoading(false));
    }, []);

    const handleChangeCategory = (index, newType) => {
        const d = devices[index];
        if (!d) return;

        // update UI trước cho mượt
        setDevices((prev) => {
            const copy = [...prev];
            copy[index] = { ...copy[index], type: newType };
            return copy;
        });

        // ghi xuống Firestore (không block UI)
        updateDevice(d.id, { type: newType }).catch((err) =>
            console.error("Update device error:", err)
        );
    };

    return (
        <>
            {/* Header giống các trang dashboard */}
            <Header />

            {/* Phần nội dung bên phải (App.jsx đã lo Sidebar rồi) */}
            <div className={styles.page}>
                {/* Hàng trên: title + 2 nút toggle */}
                <div className={styles.topRow}>
                    <h2 className={styles.title}></h2>

                    <div className={styles.switchGroup}>
                        <button className={`${styles.pillBtn} ${styles.pillActive}`}>
                            <span className={styles.pillIcon}>⏻</span>
                            <span>Energy saver</span>
                            <span className={styles.toggleDot} />
                        </button>

                        <button className={styles.pillBtn}>
                            <span className={styles.pillIcon}>⟳</span>
                            <span>Automatic calibration</span>
                        </button>
                    </div>
                </div>

                {/* CARD CONFIG CHÍNH */}
                <div className={styles.card}>
                    <div className={styles.cardTopBar}>
                        <div className={styles.cardTitle}>Config</div>

                        <div className={styles.cardControls}>
                            <div className={styles.innerSearch}>
                                <i className="ri-search-line" />
                                <input placeholder="Search" />
                            </div>

                            <div className={styles.sortBy}>
                                <span>Sort by :</span>
                                <button className={styles.sortBtn}>
                                    Alphabet <i className="ri-arrow-down-s-line" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {loading && (
                        <div className={styles.skeleton}>
                            Loading device configuration...
                        </div>
                    )}

                    <div className={styles.table}>
                        <div className={styles.headerRow}>
                            <span>Equipment</span>
                            <span>Coordinate</span>
                            <span>Category</span>
                            <span>Status</span>
                        </div>

                        {(devices ?? []).map((d, i) => (
                            <div key={d.id || i} className={styles.row}>
                                <span>{d.mac || d.id}</span>
                                <span>{d.coord || "-"}</span>

                                <div className={styles.categoryCell}>
                                    <select
                                        value={d.type || ""}
                                        onChange={(e) =>
                                            handleChangeCategory(i, e.target.value)
                                        }
                                    >
                                        <option value="">Choose</option>
                                        {categories.map((c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <span
                                    className={
                                        (d.status || "").toLowerCase() === "online"
                                            ? styles.online
                                            : styles.offline
                                    }
                                >
                                    {d.status || "Offline"}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className={styles.cardFooter}>
                        <button className={styles.saveBtn}>Save</button>
                    </div>
                </div>

                {/* CARD FORBIDDEN COORDINATES */}
                <div className={styles.forbiddenCard}>
                    <div className={styles.forbiddenHeader}>
                        <div className={styles.forbiddenTitle}>
                            Forbidden coordinates
                        </div>

                        <div className={styles.forbiddenActions}>
                            <button className={styles.addBtn}>Add</button>
                            <button className={styles.clearAllBtn}>Clear all</button>
                        </div>
                    </div>

                    <div className={styles.forbiddenBody}>
                        <div className={styles.forbiddenRow}>
                            <span>2.0 3.0 5.0</span>
                            <button className={styles.clearBtn}>Clear</button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
