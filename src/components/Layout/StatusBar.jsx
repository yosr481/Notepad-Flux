import React from 'react';

const StatusBar = ({ stats }) => {
    const { line, col, wordCount, charCount } = stats;

    return (
        <div className="status-bar">
            <div className="status-item">
                Ln {line}, Col {col}
            </div>
            <div className="status-item">
                {wordCount} words
            </div>
            <div className="status-item">
                {charCount} chars
            </div>
            <div className="status-item">
                100%
            </div>
            <div className="status-item">
                Windows (CRLF)
            </div>
            <div className="status-item">
                UTF-8
            </div>
        </div>
    );
};

export default StatusBar;
