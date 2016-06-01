"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var SwaggerError = (function (_super) {
    __extends(SwaggerError, _super);
    function SwaggerError(httpCode, errorMessage, errorCode, details) {
        _super.call(this, errorMessage);
        this.httpCode = httpCode;
        this.errorMessage = errorMessage;
        this.errorCode = errorCode;
        this.details = details;
        this.stack = (new Error()).stack;
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
