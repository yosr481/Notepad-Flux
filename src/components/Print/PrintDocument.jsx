import React from 'react';
import styles from './Print.module.css';
import '../../styles/exportBase.css';
import '../../styles/calloutExport.css';

// `html` is already sanitized, with math rendered (renderMarkdownHtml).
const PrintDocument = ({ title, html }) => {
    const htmlContent = html;

    return (
        <div className={styles.printContainer}>
            <div className={styles.header}>
                <h1>{title}</h1>
            </div>
            <div className={`${styles.content} nf-export`} dangerouslySetInnerHTML={{ __html: htmlContent }} />
            <div className={styles.footer}>
                <span className={styles.pageNumber}></span>
            </div>
        </div>
    );
};

export default PrintDocument;
