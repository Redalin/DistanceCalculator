/// <reference types="vite/client" />

declare module '*.css';

interface Window {
	__APP_CONFIG__?: {
		cartoApiKey?: string;
	};
}
