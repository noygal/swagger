"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var SwaggerError = (function (_super) {
    __extends(SwaggerError, _super);
    function SwaggerError(httpCode, errorCode, errorMessage, details) {
        _super.call(this, errorMessage);
        this.httpCode = httpCode;
        this.errorCode = errorCode;
        this.errorMessage = errorMessage;
        this.stack = (new Error()).stack;
        this.details = details;
    }
    SwaggerError.prototype.toJSON = function () {
        return {
            errorCode: this.errorCode,
            errorMessage: this.errorMessage,
            details: this.details
        };
    };
    return SwaggerError;
}(Error));
exports.SwaggerError = SwaggerError;
