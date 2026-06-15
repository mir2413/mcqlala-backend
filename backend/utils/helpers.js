function unescapeEntity(name) {
    if (!name || typeof name !== 'string') {
        return '';
    }
    return name
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#39;/g, "'");
}

function normalizeTopicName(name) {
    if (!name || typeof name !== 'string') {
        return '';
    }
    return name.trim().replace(/\s+/g, ' ').normalize('NFC');
}

module.exports = { unescapeEntity, normalizeTopicName };
