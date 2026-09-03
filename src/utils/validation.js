export const limitLength = (str, maxLength) => {
    if (typeof str !== 'string') return str;
    return str.substring(0, maxLength);
};
