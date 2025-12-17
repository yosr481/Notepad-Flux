import React, { useEffect } from 'react';
import styles from './MessageBox.module.css';

/**
 * MessageBox — design-system modal with 3 actions
 * Props:
 *  - title
 *  - message
 *  - primaryLabel (Save)
 *  - secondaryLabel (Don't Save)
 *  - cancelLabel (Cancel)
 *  - onPrimary
 *  - onSecondary
 *  - onCancel
 */
const MessageBox = ({
  title,
  message,
  primaryLabel = 'Save',
  secondaryLabel = "Don't Save",
  cancelLabel = 'Cancel',
  onPrimary,
  onSecondary,
  onCancel
}) => {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onCancel?.();
      }
      if (e.key === 'Enter') {
        onPrimary?.();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, onPrimary]);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="msgbox-title">
      <div className={styles.container}>
        {title && (
          <div className={styles.header}>
            <h3 id="msgbox-title" className={styles.title}>{title}</h3>
          </div>
        )}
        <div className={styles.content}>
          <p className={styles.message}>{message}</p>
        </div>
        <div className={styles.actions}>
          <button className={styles.cancelButton} onClick={onCancel}>{cancelLabel}</button>
          <div className={styles.spacer} />
          <button className={styles.secondaryButton} onClick={onSecondary}>{secondaryLabel}</button>
          <button className={styles.primaryButton} onClick={onPrimary}>{primaryLabel}</button>
        </div>
      </div>
    </div>
  );
};

export default MessageBox;
