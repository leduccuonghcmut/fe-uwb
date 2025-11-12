import React from 'react';
import styles from './Dashboard.module.css';
// Import các components
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import OverviewCard from '../../components/OverviewCard/OverviewCard';

// Bạn sẽ cần một thư viện biểu đồ, ví dụ: 'recharts' hoặc 'chart.js'
// Tạm thời chúng ta sẽ dùng ảnh placeholder
//import ChartPlaceholder from './chart-placeholder.png'; // Tạo 1 ảnh placeholder

const Dashboard = () => {
  
  // Dữ liệu giả cho bảng
  const performanceData = [
    { id: 1, name: 'Avg. RSSI', popularity: 45, color: '#52c41a' },
    { id: 2, name: 'Direct Path', popularity: 29, color: '#1890ff' },
    { id: 3, name: 'Noise Level', popularity: 18, color: '#9254de' },
    { id: 4, name: 'RioBright Detergent', popularity: 25, color: '#faad14' },
  ];

  return (
    <div className={styles.dashboardLayout}>
      <Sidebar />
      <div className={styles.mainContent}>
        <Header />
        
        {/* Grid Layout chính */}
        <div className={styles.contentGrid}>
          
          {/* Overview Section */}
          <div className={styles.overviewSection}>
            <h2 className={styles.sectionTitle}>Overview</h2>
            <p className={styles.sectionSubtitle}>System Overview</p>
            <div className={styles.overviewCards}>
              <OverviewCard title="Tags" value="2" icon="🏷️" color="#e6fcf5" textColor="#13c2c2" />
              <OverviewCard title="Anchors" value="6" icon="📡" color="#fff1e6" textColor="#fa8c16" />
              <OverviewCard title="Warning" value="Alarm" icon="⚠️" color="#fff2e8" textColor="#ff4d4f" />
              <OverviewCard title="Avg. Acy" value="20 cm" icon="📏" color="#f9f0ff" textColor="#722ed1" />
            </div>
          </div>

          {/* Frequency Chart */}
          <div className={styles.frequencyChart}>
            <h3 className={styles.sectionTitle}>Frequency</h3>
            <div className={styles.chartContainer}>
              {/* Đây là nơi để component biểu đồ thật */}
              <img src="https://placehold.co/600x300/f0f2f5/a0a0a0?text=Chart.js+or+Recharts+Goes+Here" alt="Frequency chart placeholder" className={styles.chartPlaceholder} />
            </div>
            <div className={styles.chartLegend}>
              <div className={styles.legendItem}>
                <span className={styles.legendColor} style={{ backgroundColor: '#1890ff' }}></span>
                Last Month
                <strong>$3,004</strong>
              </div>
              <div className={styles.legendItem}>
                <span className={styles.legendColor} style={{ backgroundColor: '#52c41a' }}></span>
                This Month
                <strong>$4,504</strong>
              </div>
            </div>
          </div>

          {/* Performance Table */}
          <div className={styles.performanceSection}>
            <h3 className={styles.sectionTitle}>Performance</h3>
            <div className={styles.performanceTable}>
              {/* Table Header */}
              <div className={`${styles.tableRow} ${styles.tableHeader}`}>
                <span>#</span>
                <span>Name</span>
                <span>Popularity</span>
                <span>Percent</span>
              </div>
              {/* Table Body */}
              {performanceData.map(item => (
                <div className={styles.tableRow} key={item.id}>
                  <span>{item.id}</span>
                  <span>{item.name}</span>
                  <div className={styles.progressBarWrapper}>
                    <div 
                      className={styles.progressBar} 
                      style={{ width: `${item.popularity}%`, backgroundColor: item.color }}
                    ></div>
                  </div>
                  <span className={styles.percentLabel}>{item.popularity}%</span>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default Dashboard;