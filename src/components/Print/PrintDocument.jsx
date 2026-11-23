import React from 'react';
import styles from './Print.module.css';
import '../../styles/exportBase.css';
import '../../styles/calloutExport.css';

// `html` is already sanitized, with math rendered (renderMarkdownHtml).
const PrintDocument = ({ title, html }) => {
    const htmlContent = html;

    return (
        <div className={styles.printContainer}>
            <h1>{title}</h1>
            <div className={`${styles.content} nf-export`} dangerouslySetInnerHTML={{ __html: htmlContent }} />
        </div>
    );
};

export default PrintDocument;
