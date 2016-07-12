export interface SwaggerEncryptedString {
    originalValue: string;
    encryptedValue: string;
}
export declare function SwaggerEncryptString(originalString: string): SwaggerEncryptedString;
