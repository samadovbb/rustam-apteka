const langUz = require('../config/lang-uz');

// Language middleware - makes translations available to all views
const languageMiddleware = (req, res, next) => {
    res.locals.lang = langUz;
    res.locals.__ = (key) => {
        const keys = key.split('.');
        let value = langUz;
        for (const k of keys) {
            value = value[k];
            if (!value) return key;
        }
        return value;
    };
    next();
};

module.exports = languageMiddleware;
