// Fixed, document-proof settings. `secure` makes Mermaid ignore these keys in a %%{init}%% directive or front matter.
export const MERMAID_CONFIG = {
    startOnLoad: false,
    securityLevel: 'strict',
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize',
        'themeCSS', 'themeVariables', 'fontFamily', 'htmlLabels', 'flowchart', 'theme', 'look', 'darkMode',
        'altFontFamily', 'dompurifyConfig', 'kanban'],
};
