/// <reference types="vite/client" />

// qrcode bringt keine eigenen Typen mit (@types/qrcode nicht installiert) — lazy import in TwoFactorSettings
declare module 'qrcode';
