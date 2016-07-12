export interface SwaggerEncryptedString {
  originalValue : string;
  encryptedValue: string;
}
export function SwaggerEncryptString(originalString : string) : SwaggerEncryptedString {
  return <SwaggerEncryptedString>{
    originalValue: originalString,
    encryptedValue: Array(originalString.length).join("*")
  };
}