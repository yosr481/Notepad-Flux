import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import styles from "./Toast.module.css";

const Toast = ({ message, duration = 3000, onClose }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`${styles.toast} ${visible ? styles.show : ""}`}>
      {message}
      <div className={styles.progressBar}></div>
    </div>
  );
};

Toast.propTypes = {
  message: PropTypes.string.isRequired,
  duration: PropTypes.number,
  onClose: PropTypes.func.isRequired,
};

export default Toast;
