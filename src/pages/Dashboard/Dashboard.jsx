import Sidebar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";
import styles from "./Dashboard.module.css";

export default function Dashboard() {
  return (
      <div className={styles.wrapper}>

        <Sidebar />

        <main className={styles.main}>
          <Header />

          {/* content dashboard */}
          <div className={styles.content}></div>
        </main>

      </div>
  );
}
