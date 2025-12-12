const langUz = require('../config/lang-uz');

// Language middleware - makes translations available to all views
const languageMiddleware = (req, res, next) => {
    res.locals.lang = langUz;
    res.locals.__ = (key) => {
        const keys = key.split('.');
        let value = langUz;
        for (const k of keys) {
            if (!value || typeof value !== 'object') return key;
            value = value[k];
            if (value === undefined || value === null) return key;
        }
        return value;
    };
    next();
};

module.exports = languageMiddleware;
