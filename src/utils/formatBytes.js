const UNITS = ['KB', 'MB', 'GB'];

// 1024-based; B whole, KB/MB/GB one decimal; no TB (huge values stay in GB). '' for anything not a finite number >= 0.
export const formatBytes = (n) => {
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return '';
    if (n < 1024) return `${Math.round(n)} B`;
    let v = n / 1024;
    let i = 0;
    while (Number(v.toFixed(1)) >= 1024 && i < UNITS.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(1)} ${UNITS[i]}`;
};
