import React from 'react';
import styles from './OverviewCard.module.css';

const OverviewCard = ({ title, value, icon, color, textColor }) => {
  const cardStyle = {
    backgroundColor: color,
  };
  
  const valueStyle = {
    color: textColor,
  };

  return (
    <div className={styles.card} style={cardStyle}>
      <div className={styles.icon}>{icon}</div>
      <div className={styles.content}>
        <div className={styles.title}>{title}</div>
        <div className={styles.value} style={valueStyle}>{value}</div>
      </div>
    </div>
  );
};

export default OverviewCard;