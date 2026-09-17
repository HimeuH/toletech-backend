// Error Handler Class
//
// `code` is a stable machine-readable string the front end can switch on
// (e.g. to show a specific UI state) without parsing the French `message`.
// `fields` is an optional { fieldName: message } map for form validation errors.
class ErrorHandler extends Error {
    constructor(message, statusCode, code = 'ERROR', fields = undefined) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.fields = fields;

        Error.captureStackTrace(this, this.constructor)
    }
}

module.exports = ErrorHandler;
