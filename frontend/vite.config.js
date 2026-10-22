import {defineConfig,loadEnv} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig(({mode})=>{const env=loadEnv(mode,fileURLToPath(new URL('../backend',import.meta.url)),'PORT');return {server:{port:5173,strictPort:true,proxy:{'/api':{target:`http://127.0.0.1:${env.PORT||3002}`,changeOrigin:true}}}}});
