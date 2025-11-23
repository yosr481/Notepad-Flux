import React, { useState, useEffect } from 'react';
import Editor from './components/Editor';
import MenuBar from './components/Layout/MenuBar';
import StatusBar from './components/Layout/StatusBar';

function App() {
    const [theme, setTheme] = useState('dark');
    const [stats, setStats] = useState({
        line: 1,
        col: 1,
        wordCount: 0,
        charCount: 0
    });

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    // Apply theme to body to ensure global styles (scrollbars, bg) update
    useEffect(() => {
        document.body.setAttribute('data-theme', theme);
    }, [theme]);

    return (
        <div className="app-container" data-theme={theme}>
            <MenuBar theme={theme} toggleTheme={toggleTheme} />

            <div className="editor-wrapper">
                <Editor onStatsUpdate={setStats} />
            </div>

            <StatusBar stats={stats} />
        </div>
    );
}

export default App;
