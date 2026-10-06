// Only the pure-JS matrix builder of `qrcode` is used (drawing is done with react-native-svg).
// Declared here because @types/qrcode would pull Node's typings into the app.
declare module 'qrcode' {
  export type QRCodeErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

  export type QRCodeMatrix = {
    size: number;
    data: Uint8Array;
  };

  export function create(
    text: string,
    options?: { errorCorrectionLevel?: QRCodeErrorCorrectionLevel },
  ): { version: number; modules: QRCodeMatrix };
}
