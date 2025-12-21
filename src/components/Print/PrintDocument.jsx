import React from 'react';
import styles from './Print.module.css';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const PrintDocument = ({ title, content }) => {
    const htmlContent = DOMPurify.sanitize(marked(content));

    return (
        <div className={styles.printContainer}>
            <div className={styles.header}>
                <h1>{title}</h1>
            </div>
            <div className={styles.content} dangerouslySetInnerHTML={{ __html: htmlContent }} />
            <div className={styles.footer}>
                <span className={styles.pageNumber}></span>
            </div>
        </div>
    );
};

export default PrintDocument;
